#!/usr/bin/env python3
"""Import CNP Mart stock analysis sheet into Postgres (local or Railway) and optionally POS SQLite."""

from __future__ import annotations

import argparse
import csv
import io
import os
import sqlite3
import subprocess
import sys
import uuid
import xml.etree.ElementTree as ET
import zipfile
from collections import Counter
from datetime import datetime, timedelta, timezone
from pathlib import Path

NS = {"m": "http://schemas.openxmlformats.org/spreadsheetml/2006/main"}
TENANT_ID = "00000000-0000-0000-0000-000000000001"
FACILITY_ID = "00000000-0000-0000-0000-000000000002"
WAREHOUSE_ID = "00000000-0000-0000-0000-000000000004"
ADMIN_ID = "00000000-0000-0000-0000-000000000005"
CASHIER_ID = "00000000-0000-0000-0000-000000000003"
PRODUCT_NS = uuid.UUID("00000000-0000-0000-0000-00000000c001")
LOT_NS = uuid.UUID("00000000-0000-0000-0000-00000000c002")
STOCK_NS = uuid.UUID("00000000-0000-0000-0000-00000000c003")


def parse_args() -> argparse.Namespace:
    root = Path(__file__).resolve().parents[1]
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument(
        "--xlsx",
        type=Path,
        default=root / "data" / "STOCK_ANALYSIS_SHEET_20261126143124.xlsx",
    )
    parser.add_argument(
        "--pos-db",
        type=Path,
        default=Path.home() / ".config" / "mart-pos-terminal" / "data" / "mart-pos.db",
    )
    parser.add_argument(
        "--database-url",
        default=os.environ.get("DATABASE_URL", ""),
        help="Postgres URL (Railway public URL). Overrides local docker container.",
    )
    parser.add_argument("--pg-container", default="mart-postgres")
    parser.add_argument("--pg-user", default="mart_admin")
    parser.add_argument("--pg-db", default="mart_omnichannel")
    parser.add_argument("--skip-postgres", action="store_true")
    parser.add_argument("--skip-pos", action="store_true")
    parser.add_argument(
        "--railway",
        action="store_true",
        help="Import to Railway only (uses DATABASE_URL, skips POS).",
    )
    parser.add_argument(
        "--stock-only",
        action="store_true",
        help="Import only rows with Closing Qty > 0",
    )
    return parser.parse_args()


def bcrypt_hash(password: str) -> str:
    backend = Path(__file__).resolve().parents[1] / "central-backend"
    proc = subprocess.run(
        [
            "bash",
            "-lc",
            f'source "$HOME/.nvm/nvm.sh" && nvm use 20 >/dev/null && '
            f'node -e "console.log(require(\'bcryptjs\').hashSync(process.argv[1], 10))" {password}',
        ],
        cwd=str(backend),
        capture_output=True,
        text=True,
        check=False,
    )
    if proc.returncode != 0 or not proc.stdout.strip():
        raise RuntimeError(f"bcrypt hash failed: {proc.stderr or proc.stdout}")
    return proc.stdout.strip()


def psql_base(args: argparse.Namespace) -> list[str]:
    """Return base argv to run psql against local docker OR remote DATABASE_URL."""
    if args.database_url:
        # Use official client image so we don't need local psql.
        return [
            "docker",
            "run",
            "--rm",
            "-i",
            "postgres:15-alpine",
            "psql",
            args.database_url,
            "-v",
            "ON_ERROR_STOP=1",
        ]
    return [
        "docker",
        "exec",
        "-i",
        args.pg_container,
        "psql",
        "-U",
        args.pg_user,
        "-d",
        args.pg_db,
        "-v",
        "ON_ERROR_STOP=1",
    ]

def cell_value(cell: ET.Element, shared: list[str]):
    t = cell.get("t")
    v = cell.find("m:v", NS)
    if v is None or v.text is None:
        return None
    if t == "s":
        return shared[int(v.text)]
    if t == "b":
        return bool(int(v.text))
    try:
        if "." in v.text:
            return float(v.text)
        return int(v.text)
    except ValueError:
        return v.text


def row_cells(row: ET.Element, shared: list[str]) -> dict[str, object]:
    out: dict[str, object] = {}
    for cell in row.findall("m:c", NS):
        ref = cell.get("r", "")
        col = "".join(ch for ch in ref if ch.isalpha())
        out[col] = cell_value(cell, shared)
    return out


def load_records(xlsx_path: Path) -> list[dict]:
    with zipfile.ZipFile(xlsx_path) as zf:
        shared_root = ET.fromstring(zf.read("xl/sharedStrings.xml"))
        shared: list[str] = []
        for si in shared_root.findall("m:si", NS):
            texts = [
                t.text or ""
                for t in si.iter("{http://schemas.openxmlformats.org/spreadsheetml/2006/main}t")
            ]
            shared.append("".join(texts))

        sheet = ET.fromstring(zf.read("xl/worksheets/sheet1.xml"))
        rows = sheet.findall("m:sheetData/m:row", NS)

    header_cells = row_cells(rows[1], shared)
    cols = sorted(header_cells.keys(), key=lambda x: (len(x), x))
    headers = {col: str(header_cells[col]) for col in cols}

    records: list[dict] = []
    for row in rows[2:]:
        cells = row_cells(row, shared)
        if not cells:
            continue
        rec = {headers[col]: cells.get(col) for col in cols}
        if rec.get("Item_ID") is None or not str(rec.get("Item Name") or "").strip():
            continue
        records.append(rec)
    return records


def to_float(value, default: float = 0.0) -> float:
    try:
        if value is None or value == "":
            return default
        return float(value)
    except (TypeError, ValueError):
        return default


def to_qty(value) -> int:
    qty = int(round(to_float(value)))
    return max(0, qty)


def clean_barcode(value) -> str:
    if value is None:
        return ""
    return str(value).strip()


def truncate(value: str | None, limit: int) -> str:
    text = (value or "").strip()
    return text[:limit]


def assign_base_barcodes(records: list[dict]) -> dict[int, str]:
    """Keep original barcode when unique; for collisions keep original on all
    (POS multi-lot lookup) but ensure non-empty and <= 32 chars.
    Empty barcodes become CNP-{Item_ID}.
    """
    counts = Counter(clean_barcode(r.get("Barcode")) for r in records)
    assigned: dict[int, str] = {}
    for rec in records:
        item_id = int(rec["Item_ID"])
        raw = clean_barcode(rec.get("Barcode"))
        if not raw:
            barcode = f"CNP-{item_id}"
        else:
            barcode = raw
        if len(barcode) > 32:
            barcode = f"CNP-{item_id}"
        assigned[item_id] = barcode
        # silence unused for now; counts kept for reporting
        _ = counts[raw]
    return assigned


def build_rows(records: list[dict], stock_only: bool) -> tuple[list[dict], dict]:
    now = datetime.now(timezone.utc)
    manufacture = now
    expiry = now + timedelta(days=730)
    barcodes = assign_base_barcodes(records)

    products: list[dict] = []
    stats = {
        "source_rows": len(records),
        "imported": 0,
        "skipped_zero": 0,
        "with_stock": 0,
        "total_qty": 0,
        "duplicate_barcodes_kept": 0,
        "empty_barcode_filled": 0,
    }

    barcode_counts = Counter(clean_barcode(r.get("Barcode")) for r in records)
    stats["duplicate_barcodes_kept"] = sum(1 for b, c in barcode_counts.items() if b and c > 1)

    for rec in records:
        item_id = int(rec["Item_ID"])
        qty = to_qty(rec.get("Closing Qty"))
        if stock_only and qty <= 0:
            stats["skipped_zero"] += 1
            continue

        name = truncate(str(rec.get("Item Name")), 512)
        brand = truncate(str(rec.get("Brand") or ""), 128)
        size = truncate(str(rec.get("Size") or ""), 32)
        color = truncate(str(rec.get("Colour") or ""), 32)
        raw_bc = clean_barcode(rec.get("Barcode"))
        base_barcode = barcodes[item_id]
        if not raw_bc:
            stats["empty_barcode_filled"] += 1

        mrp = round(to_float(rec.get("MRP")), 2)
        sale_rate = round(to_float(rec.get("Rate"), mrp), 2)
        if sale_rate <= 0:
            sale_rate = mrp
        avg_cost = round(to_float(rec.get("AVG Closing Purchase Value")), 2)
        closing_val = round(to_float(rec.get("Closing Purchase Value")), 2)
        if avg_cost <= 0 and qty > 0 and closing_val > 0:
            avg_cost = round(closing_val / qty, 2)
        if avg_cost < 0:
            avg_cost = 0.0

        sku = f"CNP-{item_id}"
        product_id = str(uuid.uuid5(PRODUCT_NS, sku))
        lot_id = str(uuid.uuid5(LOT_NS, sku))
        stock_id = str(uuid.uuid5(STOCK_NS, sku))
        lot_barcode = f"LOT-CNP-{item_id}"
        if len(lot_barcode) > 64:
            lot_barcode = f"LOT-{item_id}"

        description_parts = [f"Legacy Item_ID={item_id}"]
        if raw_bc and raw_bc != base_barcode:
            description_parts.append(f"original_barcode={raw_bc}")
        if brand:
            description_parts.append(f"brand={brand}")
        if size:
            description_parts.append(f"size={size}")

        products.append(
            {
                "product_id": product_id,
                "lot_id": lot_id,
                "stock_id": stock_id,
                "tenant_id": TENANT_ID,
                "facility_id": FACILITY_ID,
                "sku": sku,
                "base_barcode": base_barcode,
                "name": name,
                "description": "; ".join(description_parts),
                "company": brand,
                "size": size,
                "color": color,
                "hsn_code": "",
                "batch_number": f"OPENING-{item_id}",
                "cost_price": avg_cost,
                "mrp": mrp,
                "sale_rate": sale_rate,
                "manufacture_date": manufacture.isoformat(),
                "expiry_date": expiry.isoformat(),
                "lot_barcode": lot_barcode,
                "quantity_on_hand": qty,
                "aisle_shelf_location": None,
                "item_id": item_id,
            }
        )
        stats["imported"] += 1
        if qty > 0:
            stats["with_stock"] += 1
            stats["total_qty"] += qty

    return products, stats


def pg_exec(args: argparse.Namespace, sql: str, check: bool = True) -> subprocess.CompletedProcess:
    return subprocess.run(
        psql_base(args),
        input=sql,
        text=True,
        capture_output=True,
        check=check,
    )


def copy_csv(args: argparse.Namespace, table: str, columns: list[str], rows: list[dict]) -> None:
    buf = io.StringIO()
    writer = csv.writer(buf, lineterminator="\n")
    for row in rows:
        writer.writerow([row[col] if row[col] is not None else r"\N" for col in columns])
    quoted_cols = ", ".join(f'"{col}"' for col in columns)
    sql = f"COPY {table} ({quoted_cols}) FROM STDIN WITH (FORMAT csv, NULL '\\N');\n"
    proc = subprocess.run(
        [*psql_base(args), "-c", sql],
        input=buf.getvalue(),
        text=True,
        capture_output=True,
        check=False,
    )
    if proc.returncode != 0:
        raise RuntimeError(f"COPY {table} failed:\n{proc.stderr or proc.stdout}")


def ensure_tenant_bootstrap(args: argparse.Namespace) -> None:
    """Create CNP Mart tenant/facility/users if missing (needed on fresh Railway DB)."""
    print("Postgres: ensuring tenant / facility / users…")
    password_hash = bcrypt_hash("admin123")
    # Escape single quotes for SQL literals
    ph = password_hash.replace("'", "''")
    sql = f"""
    INSERT INTO tenants (id, name, subdomain, status, metadata)
    VALUES (
      '{TENANT_ID}',
      'CNP Mart',
      'demo-mart',
      'ACTIVE',
      '{{"theme":{{"primaryColor":"#0f766e"}},"taxParameters":{{"currencyCode":"INR","gstRate":18}},"featureFlags":{{"enableLotTracking":true,"enableOfflinePos":true}}}}'::jsonb
    )
    ON CONFLICT (id) DO UPDATE SET name = EXCLUDED.name, status = 'ACTIVE';

    INSERT INTO facilities (id, "tenantId", type, name, shortcut, state, gstin, mobile, "registerType", "geoCoordinates", "isActive")
    VALUES
      (
        '{FACILITY_ID}', '{TENANT_ID}', 'RETAIL_STORE', 'CNP Mart — Main', 'CNP',
        'Uttarakhand', '05AAAAA0000A1Z5', '8393926666', 'Registered-Regular',
        '{{"latitude":30.3165,"longitude":78.0322,"accuracyMeters":10}}'::jsonb, true
      ),
      (
        '{WAREHOUSE_ID}', '{TENANT_ID}', 'WAREHOUSE', 'CNP Warehouse', 'WH1',
        'Uttarakhand', '05AAAAA0000A1Z5', '8393926667', 'Registered-Regular',
        '{{"latitude":30.32,"longitude":78.04,"accuracyMeters":10}}'::jsonb, true
      )
    ON CONFLICT (id) DO UPDATE SET name = EXCLUDED.name, "isActive" = true;

    INSERT INTO users (id, "tenantId", email, username, "fullName", mobile, "passwordHash", role, "isActive")
    VALUES
      (
        '{ADMIN_ID}', '{TENANT_ID}', 'admin@demo-mart.local', 'admin', 'Store Admin',
        '8393926666', '{ph}', 'MART_ADMIN', true
      ),
      (
        '{CASHIER_ID}', '{TENANT_ID}', 'cashier@demo-mart.local', 'cashier', 'Demo Cashier',
        '9876543210', '{ph}', 'CASHIER', true
      )
    ON CONFLICT (id) DO UPDATE SET "isActive" = true, "passwordHash" = EXCLUDED."passwordHash";
    """
    result = pg_exec(args, sql, check=False)
    if result.returncode != 0:
        raise RuntimeError(f"Tenant bootstrap failed:\n{result.stderr or result.stdout}")
    print("Postgres: tenant bootstrap OK")


def import_postgres(args: argparse.Namespace, products: list[dict]) -> None:
    target = "Railway/remote" if args.database_url else f"local docker:{args.pg_container}"
    print(f"Postgres target: {target}")
    ensure_tenant_bootstrap(args)

    print("Postgres: clearing previous CNP import / demo catalog…")
    # Safe while no order_items reference products
    clear_sql = """
    DELETE FROM lot_inventory_stock
      WHERE "lotId" IN (
        SELECT id FROM product_lots
        WHERE "lotBarcode" LIKE 'LOT-CNP-%' OR "lotBarcode" LIKE 'LOT-MILK-%'
           OR "lotBarcode" LIKE 'LOT-RICE-%' OR "lotBarcode" LIKE 'LOT-OIL-%'
           OR "lotBarcode" LIKE 'LOT-SOAP-%' OR "lotBarcode" LIKE 'LOT-BREAD-%'
      );
    DELETE FROM product_lots
      WHERE "lotBarcode" LIKE 'LOT-CNP-%' OR "lotBarcode" LIKE 'LOT-MILK-%'
         OR "lotBarcode" LIKE 'LOT-RICE-%' OR "lotBarcode" LIKE 'LOT-OIL-%'
         OR "lotBarcode" LIKE 'LOT-SOAP-%' OR "lotBarcode" LIKE 'LOT-BREAD-%';
    DELETE FROM products
      WHERE sku LIKE 'CNP-%'
         OR sku IN ('MILK-ORG-1L','RICE-BAS-5KG','OIL-SUN-1L','SOAP-DOVE-100','BREAD-WHT-400');
    """
    result = pg_exec(args, clear_sql)
    if result.returncode != 0:
        raise RuntimeError(f"Clear failed:\n{result.stderr or result.stdout}")
    if result.stderr:
        print(result.stderr.strip())
    print(f"Postgres: inserting {len(products)} products…")
    copy_csv(
        args,
        "products",
        ["id", "tenantId", "sku", "baseBarcode", "name", "description", "isActive"],
        [
            {
                "id": p["product_id"],
                "tenantId": p["tenant_id"],
                "sku": p["sku"],
                "baseBarcode": p["base_barcode"],
                "name": p["name"],
                "description": p["description"],
                "isActive": "t",
            }
            for p in products
        ],
    )

    print(f"Postgres: inserting {len(products)} lots…")
    copy_csv(
        args,
        "product_lots",
        [
            "id",
            "productId",
            "batchNumber",
            "costPrice",
            "mrp",
            "manufactureDate",
            "expiryDate",
            "lotBarcode",
            "isActive",
        ],
        [
            {
                "id": p["lot_id"],
                "productId": p["product_id"],
                "batchNumber": p["batch_number"],
                "costPrice": f"{p['cost_price']:.2f}",
                "mrp": f"{p['mrp']:.2f}",
                "manufactureDate": p["manufacture_date"],
                "expiryDate": p["expiry_date"],
                "lotBarcode": p["lot_barcode"],
                "isActive": "t",
            }
            for p in products
        ],
    )

    print(f"Postgres: inserting {len(products)} stock rows…")
    copy_csv(
        args,
        "lot_inventory_stock",
        ["id", "lotId", "facilityId", "quantityOnHand", "aisleShelfLocation"],
        [
            {
                "id": p["stock_id"],
                "lotId": p["lot_id"],
                "facilityId": p["facility_id"],
                "quantityOnHand": p["quantity_on_hand"],
                "aisleShelfLocation": p["aisle_shelf_location"],
            }
            for p in products
        ],
    )

    # If TypeORM has added extended product columns, backfill pricing/attrs from lots + sheet.
    cols = pg_exec(
        args,
        "SELECT column_name FROM information_schema.columns "
        "WHERE table_name = 'products' ORDER BY ordinal_position;",
    ).stdout
    has_mrp = "mrp" in (cols or "")
    if has_mrp:
        print("Postgres: backfilling product mrp/sale/purchase/size/brand…")
        buf = io.StringIO()
        writer = csv.writer(buf, lineterminator="\n")
        for p in products:
            writer.writerow(
                [
                    p["product_id"],
                    f"{p['mrp']:.2f}",
                    f"{p['sale_rate']:.2f}",
                    f"{p['cost_price']:.2f}",
                    p["company"] or "",
                    p["size"] or "",
                    p["color"] or "",
                ]
            )
        tmp_sql = """
        CREATE TEMP TABLE tmp_prod_price (
          id uuid, mrp numeric, sale_rate numeric, purchase_rate numeric,
          brand text, size text, color text
        );
        COPY tmp_prod_price FROM STDIN WITH (FORMAT csv);
        UPDATE products p SET
          mrp = t.mrp,
          "saleRate" = t.sale_rate,
          "purchaseRate" = t.purchase_rate,
          brand = NULLIF(t.brand, ''),
          company = NULLIF(t.brand, ''),
          size = NULLIF(t.size, ''),
          color = NULLIF(t.color, ''),
          unit = COALESCE(p.unit, 'PCS'),
          "updatedAt" = NOW()
        FROM tmp_prod_price t
        WHERE p.id = t.id;
        DROP TABLE tmp_prod_price;
        """
        proc = subprocess.run(
            [*psql_base(args), "-c", tmp_sql],
            input=buf.getvalue(),
            text=True,
            capture_output=True,
            check=False,
        )
        if proc.returncode != 0:
            print("WARN product backfill failed:", proc.stderr or proc.stdout)
        else:
            print("Postgres: product pricing backfilled")
    verify = pg_exec(
        args,
        """
        SELECT
          (SELECT COUNT(*) FROM products WHERE sku LIKE 'CNP-%') AS products,
          (SELECT COUNT(*) FROM product_lots WHERE "lotBarcode" LIKE 'LOT-CNP-%') AS lots,
          (SELECT COALESCE(SUM("quantityOnHand"),0) FROM lot_inventory_stock s
             JOIN product_lots l ON l.id = s."lotId"
             WHERE l."lotBarcode" LIKE 'LOT-CNP-%') AS qty;
        """,
    )
    print("Postgres verify:", (verify.stdout or "").strip())


def import_pos(args: argparse.Namespace, products: list[dict]) -> None:
    db_path = args.pos_db
    if not db_path.exists():
        raise FileNotFoundError(f"POS database not found: {db_path}")

    print(f"POS SQLite: updating {db_path}")
    conn = sqlite3.connect(str(db_path))
    try:
        conn.execute("PRAGMA foreign_keys = ON")
        # Remove previous sample + CNP lots
        conn.execute(
            """
            DELETE FROM product_lots_local
            WHERE product_sku LIKE 'CNP-%'
               OR product_sku IN ('MILK-ORG-1L','RICE-BAS-5KG','OIL-SUN-1L','SOAP-DOVE-100','BREAD-WHT-400')
               OR lot_barcode LIKE 'LOT-CNP-%'
               OR lot_barcode LIKE 'LOT-MILK-%'
               OR lot_barcode LIKE 'LOT-RICE-%'
            """
        )

        insert = conn.execute
        stmt = """
            INSERT INTO product_lots_local (
              id, product_id, product_name, product_sku, base_barcode,
              company, size, color, hsn_code,
              batch_number, cost_price, mrp, sale_rate,
              manufacture_date, expiry_date, lot_barcode,
              quantity_on_hand, aisle_shelf_location, facility_id, updated_at
            ) VALUES (
              ?, ?, ?, ?, ?,
              ?, ?, ?, ?,
              ?, ?, ?, ?,
              ?, ?, ?,
              ?, ?, ?, datetime('now')
            )
        """
        rows = [
            (
                p["lot_id"],
                p["product_id"],
                p["name"],
                p["sku"],
                p["base_barcode"],
                p["company"],
                p["size"],
                p["color"],
                p["hsn_code"],
                p["batch_number"],
                p["cost_price"],
                p["mrp"],
                p["sale_rate"],
                p["manufacture_date"],
                p["expiry_date"],
                p["lot_barcode"],
                p["quantity_on_hand"],
                p["aisle_shelf_location"],
                p["facility_id"],
            )
            for p in products
        ]
        conn.executemany(stmt, rows)

        # Keep POS config aligned with demo tenant/facility used by portal
        for key, value in {
            "tenantId": TENANT_ID,
            "facilityId": FACILITY_ID,
            "facilityName": "CNP Mart — Main",
            "shopName": "CNP Mart",
        }.items():
            conn.execute(
                "INSERT INTO pos_config (key, value) VALUES (?, ?) "
                "ON CONFLICT(key) DO UPDATE SET value = excluded.value",
                (key, value),
            )

        conn.commit()
        total = conn.execute("SELECT COUNT(*), COALESCE(SUM(quantity_on_hand),0) FROM product_lots_local").fetchone()
        print(f"POS verify: lots={total[0]} qty={total[1]}")
    finally:
        conn.close()


def main() -> int:
    args = parse_args()
    if args.railway:
        args.skip_pos = True
        if not args.database_url:
            print(
                "Missing DATABASE_URL.\n"
                "In Railway → Postgres service → Variables → copy DATABASE_PUBLIC_URL "
                "(or DATABASE_URL if it is publicly reachable), then run:\n\n"
                "  DATABASE_URL='postgresql://...' python3 scripts/import-stock-sheet.py --railway\n",
                file=sys.stderr,
            )
            return 2

    if not args.xlsx.exists():
        print(f"Missing sheet: {args.xlsx}", file=sys.stderr)
        return 1

    print(f"Reading {args.xlsx} …")
    records = load_records(args.xlsx)
    products, stats = build_rows(records, stock_only=args.stock_only)
    print(
        f"Prepared {stats['imported']} products "
        f"({stats['with_stock']} with stock, qty={stats['total_qty']}; "
        f"skipped_zero={stats['skipped_zero']})"
    )

    if not args.skip_postgres:
        import_postgres(args, products)
    if not args.skip_pos:
        import_pos(args, products)

    print("Done.")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
