#!/usr/bin/env python3
"""Import CNP Mart itemwise sale Excel into historical order_invoices / order_items.

Preserves Bill_Number and Bill_Date. Does NOT adjust stock or write stock_movements
(closing stock already lives in the catalog from the stock sheet import).
"""

from __future__ import annotations

import argparse
import csv
import hashlib
import io
import json
import os
import re
import sqlite3
import subprocess
import sys
import uuid
import xml.etree.ElementTree as ET
import zipfile
from collections import defaultdict
from datetime import datetime, timedelta, timezone
from pathlib import Path

NS = {"m": "http://schemas.openxmlformats.org/spreadsheetml/2006/main"}
TENANT_ID = "00000000-0000-0000-0000-000000000001"
FACILITY_ID = "00000000-0000-0000-0000-000000000002"
CASHIER_ID = "00000000-0000-0000-0000-000000000003"
PRODUCT_NS = uuid.UUID("00000000-0000-0000-0000-00000000c001")
LOT_NS = uuid.UUID("00000000-0000-0000-0000-00000000c002")
STOCK_NS = uuid.UUID("00000000-0000-0000-0000-00000000c003")
ORDER_NS = uuid.UUID("00000000-0000-0000-0000-00000000c010")
ORDER_ITEM_NS = uuid.UUID("00000000-0000-0000-0000-00000000c011")
IST = timezone(timedelta(hours=5, minutes=30))


def parse_args() -> argparse.Namespace:
    root = Path(__file__).resolve().parents[1]
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument(
        "--xlsx",
        type=Path,
        default=root / "sale_report_itemwise_sale_20261127152241.xlsx",
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
        "--dry-run",
        action="store_true",
        help="Parse + match only; print stats without writing.",
    )
    parser.add_argument(
        "--replace",
        action="store_true",
        default=True,
        help="Replace existing invoices with the same invoice numbers (default).",
    )
    parser.add_argument(
        "--no-replace",
        action="store_true",
        help="Skip bills whose invoice numbers already exist.",
    )
    return parser.parse_args()


def psql_base(args: argparse.Namespace) -> list[str]:
    if args.database_url:
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


def pg_exec(args: argparse.Namespace, sql: str, check: bool = True) -> subprocess.CompletedProcess:
    return subprocess.run(
        psql_base(args),
        input=sql,
        text=True,
        capture_output=True,
        check=check,
    )


def copy_csv(args: argparse.Namespace, table: str, columns: list[str], rows: list[dict]) -> None:
    if not rows:
        return
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


def load_sale_rows(xlsx_path: Path) -> list[dict]:
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

    # Title on row 3, headers on row 5 (1-indexed) → find header by Bill_Number
    header_row_idx = None
    headers: dict[str, str] = {}
    for i, row in enumerate(rows):
        cells = row_cells(row, shared)
        vals = {str(v).strip() for v in cells.values() if v is not None}
        if "Bill_Number" in vals and "Item_Name" in vals:
            header_row_idx = i
            cols = sorted(cells.keys(), key=lambda x: (len(x), x))
            headers = {col: str(cells[col]).strip() for col in cols if cells.get(col) is not None}
            break
    if header_row_idx is None:
        raise RuntimeError("Could not find Sale Itemwise header row (Bill_Number / Item_Name)")

    records: list[dict] = []
    for row in rows[header_row_idx + 1 :]:
        cells = row_cells(row, shared)
        if not cells:
            continue
        full = {headers[col]: cells.get(col) for col in headers}
        if str(full.get("ID") or "").strip().lower() == "total":
            continue
        bill = str(full.get("Bill_Number") or "").strip()
        name = str(full.get("Item_Name") or "").strip()
        if not bill or not name:
            continue
        records.append(full)
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
    text = str(value).strip()
    if text.endswith(".0") and text.replace(".", "", 1).isdigit():
        text = text[:-2]
    return text


def normalize_name(value: str) -> str:
    text = (value or "").casefold().strip()
    text = re.sub(r"\s+", " ", text)
    return text


def truncate(value: str | None, limit: int) -> str:
    return (value or "").strip()[:limit]


def parse_bill_date(value) -> datetime:
    """Noon IST on the bill date → store as timestamptz."""
    if isinstance(value, datetime):
        dt = value
    else:
        text = str(value or "").strip()
        # Excel serial?
        try:
            as_float = float(text)
            if as_float > 40000:
                # days since 1899-12-30
                base = datetime(1899, 12, 30, tzinfo=timezone.utc)
                return (base + timedelta(days=as_float)).astimezone(IST).replace(
                    hour=12, minute=0, second=0, microsecond=0
                )
        except ValueError:
            pass
        for fmt in ("%Y-%m-%d", "%d-%m-%Y", "%d/%m/%Y", "%Y/%m/%d"):
            try:
                dt = datetime.strptime(text[:10], fmt)
                break
            except ValueError:
                dt = None
        if dt is None:
            dt = datetime.now(IST)
    if dt.tzinfo is None:
        dt = dt.replace(tzinfo=IST)
    return dt.astimezone(IST).replace(hour=12, minute=0, second=0, microsecond=0)


def stable_hist_key(barcode: str, name: str) -> str:
    raw = barcode if barcode else normalize_name(name)
    digest = hashlib.sha1(raw.encode("utf-8")).hexdigest()[:12]
    return digest


def load_catalog(args: argparse.Namespace) -> tuple[dict[str, dict], dict[str, dict]]:
    """Return (by_barcode, by_name) maps → {product_id, lot_id, name, barcode}."""
    sql = f"""
    COPY (
      SELECT
        p.id::text AS product_id,
        COALESCE(
          (
            SELECT l.id::text FROM product_lots l
            WHERE l."productId" = p.id AND l."isActive" = true
            ORDER BY
              CASE WHEN l."lotBarcode" LIKE 'LOT-CNP-%' THEN 0 ELSE 1 END,
              l."createdAt" ASC
            LIMIT 1
          ),
          ''
        ) AS lot_id,
        p."baseBarcode" AS barcode,
        p.name AS name
      FROM products p
      WHERE p."tenantId" = '{TENANT_ID}' AND p."isActive" = true
    ) TO STDOUT WITH (FORMAT csv, HEADER true);
    """
    proc = pg_exec(args, sql, check=False)
    if proc.returncode != 0:
        raise RuntimeError(f"Load catalog failed:\n{proc.stderr or proc.stdout}")
    reader = csv.DictReader(io.StringIO(proc.stdout))
    by_barcode: dict[str, dict] = {}
    by_name: dict[str, dict] = {}
    for row in reader:
        if not row.get("lot_id"):
            continue
        entry = {
            "product_id": row["product_id"],
            "lot_id": row["lot_id"],
            "name": row["name"],
            "barcode": row["barcode"],
        }
        bc = clean_barcode(row["barcode"])
        if bc and bc not in by_barcode:
            by_barcode[bc] = entry
        nkey = normalize_name(row["name"])
        if nkey and nkey not in by_name:
            by_name[nkey] = entry
    return by_barcode, by_name


def group_bills(records: list[dict]) -> list[dict]:
    groups: dict[str, dict] = {}
    order: list[str] = []
    for rec in records:
        bill = truncate(str(rec.get("Bill_Number") or ""), 32)
        if not bill:
            continue
        if bill not in groups:
            groups[bill] = {
                "invoice_number": bill,
                "bill_date": parse_bill_date(rec.get("Bill_Date")),
                "customer_name": truncate(str(rec.get("Customer_Name") or "Walk-in"), 128) or "Walk-in",
                "customer_mobile": clean_barcode(rec.get("Customer_Mobile"))[:20],
                "lines": [],
            }
            order.append(bill)
        groups[bill]["lines"].append(rec)
        # Prefer non-default customer if present on later lines
        name = truncate(str(rec.get("Customer_Name") or ""), 128)
        if name and name.upper() != "CNP MART":
            groups[bill]["customer_name"] = name
            mobile = clean_barcode(rec.get("Customer_Mobile"))[:20]
            if mobile:
                groups[bill]["customer_mobile"] = mobile
    return [groups[k] for k in order]


def resolve_lines(
    bills: list[dict],
    by_barcode: dict[str, dict],
    by_name: dict[str, dict],
) -> tuple[list[dict], list[dict], dict]:
    """Attach product/lot ids; collect stub products to create. Returns bills, stubs, stats."""
    stubs: dict[str, dict] = {}
    stats = {
        "lines": 0,
        "matched_barcode": 0,
        "matched_name": 0,
        "stubbed": 0,
        "net_total": 0.0,
        "bills": len(bills),
    }
    now = datetime.now(timezone.utc)
    manufacture = now
    expiry = now + timedelta(days=730)

    for bill in bills:
        resolved = []
        for rec in bill["lines"]:
            stats["lines"] += 1
            name = truncate(str(rec.get("Item_Name") or ""), 512)
            barcode = clean_barcode(rec.get("Barcode"))
            qty = to_qty(rec.get("Qty"))
            if qty <= 0:
                continue
            unit_price = round(to_float(rec.get("Saleprice")), 2)
            mrp = round(to_float(rec.get("Mrp"), unit_price), 2)
            net = round(to_float(rec.get("Net_Amount"), unit_price * qty), 2)
            stats["net_total"] += net

            match = None
            source = "stub"
            if barcode and barcode in by_barcode:
                match = by_barcode[barcode]
                source = "barcode"
                stats["matched_barcode"] += 1
            else:
                nkey = normalize_name(name)
                if nkey in by_name:
                    match = by_name[nkey]
                    source = "name"
                    stats["matched_name"] += 1

            if match is None:
                hist = stable_hist_key(barcode, name)
                sku = f"CNP-HIST-{hist}"
                if sku not in stubs:
                    product_id = str(uuid.uuid5(PRODUCT_NS, sku))
                    lot_id = str(uuid.uuid5(LOT_NS, sku))
                    stock_id = str(uuid.uuid5(STOCK_NS, sku))
                    base_bc = barcode if barcode and len(barcode) <= 32 else f"HIST-{hist}"[:32]
                    stubs[sku] = {
                        "product_id": product_id,
                        "lot_id": lot_id,
                        "stock_id": stock_id,
                        "sku": sku,
                        "base_barcode": base_bc,
                        "name": name or sku,
                        "description": f"Historical sale stub; barcode={barcode or '-'}",
                        "lot_barcode": f"LOT-HIST-{hist}"[:64],
                        "batch_number": f"HIST-{hist}",
                        "mrp": mrp,
                        "sale_rate": unit_price if unit_price > 0 else mrp,
                        "cost_price": 0.0,
                        "manufacture_date": manufacture.isoformat(),
                        "expiry_date": expiry.isoformat(),
                    }
                    # register for later lines in same run
                    entry = {
                        "product_id": product_id,
                        "lot_id": lot_id,
                        "name": name,
                        "barcode": base_bc,
                    }
                    if base_bc:
                        by_barcode[base_bc] = entry
                    by_name[normalize_name(name)] = entry
                else:
                    product_id = stubs[sku]["product_id"]
                    lot_id = stubs[sku]["lot_id"]
                stats["stubbed"] += 1
                source = "stub"
            else:
                product_id = match["product_id"]
                lot_id = match["lot_id"]

            line_id_key = f"{bill['invoice_number']}|{rec.get('ID')}|{name}|{qty}|{net}"
            resolved.append(
                {
                    "id": str(uuid.uuid5(ORDER_ITEM_NS, line_id_key)),
                    "product_id": product_id,
                    "lot_id": lot_id,
                    "barcode": barcode[:64] if barcode else None,
                    "quantity": qty,
                    "unit_price": unit_price,
                    "mrp": mrp,
                    "net_amount": net,
                    "match_source": source,
                    "name": name,
                }
            )
        bill["resolved_lines"] = resolved
        bill["subtotal"] = round(sum(l["net_amount"] for l in resolved), 2)
        bill["id"] = str(uuid.uuid5(ORDER_NS, f"{TENANT_ID}|{bill['invoice_number']}"))

    stats["stub_skus"] = len(stubs)
    stats["net_total"] = round(stats["net_total"], 2)
    return bills, list(stubs.values()), stats


def existing_invoice_numbers(args: argparse.Namespace, numbers: list[str]) -> set[str]:
    if not numbers:
        return set()
    # chunk to avoid huge IN lists
    found: set[str] = set()
    chunk_size = 500
    for i in range(0, len(numbers), chunk_size):
        chunk = numbers[i : i + chunk_size]
        vals = ",".join("'" + n.replace("'", "''") + "'" for n in chunk)
        sql = f"""
        COPY (
          SELECT "invoiceNumber" FROM order_invoices
          WHERE "tenantId" = '{TENANT_ID}' AND "invoiceNumber" IN ({vals})
        ) TO STDOUT WITH (FORMAT csv);
        """
        proc = pg_exec(args, sql, check=False)
        if proc.returncode != 0:
            raise RuntimeError(f"Lookup invoices failed:\n{proc.stderr or proc.stdout}")
        for line in (proc.stdout or "").splitlines():
            if line.strip():
                found.add(line.strip())
    return found


def insert_stubs(args: argparse.Namespace, stubs: list[dict]) -> None:
    if not stubs:
        return
    print(f"Postgres: inserting {len(stubs)} historical stub products…")
    copy_csv(
        args,
        "products",
        ["id", "tenantId", "sku", "baseBarcode", "name", "description", "isActive"],
        [
            {
                "id": s["product_id"],
                "tenantId": TENANT_ID,
                "sku": s["sku"],
                "baseBarcode": s["base_barcode"],
                "name": s["name"],
                "description": s["description"],
                "isActive": "t",
            }
            for s in stubs
        ],
    )
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
                "id": s["lot_id"],
                "productId": s["product_id"],
                "batchNumber": s["batch_number"],
                "costPrice": f"{s['cost_price']:.2f}",
                "mrp": f"{s['mrp']:.2f}",
                "manufactureDate": s["manufacture_date"],
                "expiryDate": s["expiry_date"],
                "lotBarcode": s["lot_barcode"],
                "isActive": "t",
            }
            for s in stubs
        ],
    )
    copy_csv(
        args,
        "lot_inventory_stock",
        ["id", "lotId", "facilityId", "quantityOnHand", "aisleShelfLocation"],
        [
            {
                "id": s["stock_id"],
                "lotId": s["lot_id"],
                "facilityId": FACILITY_ID,
                "quantityOnHand": 0,
                "aisleShelfLocation": r"\N",
            }
            for s in stubs
        ],
    )
    # Optional pricing columns
    cols = pg_exec(
        args,
        "SELECT column_name FROM information_schema.columns "
        "WHERE table_name = 'products' ORDER BY ordinal_position;",
    ).stdout
    if cols and "mrp" in cols:
        buf = io.StringIO()
        writer = csv.writer(buf, lineterminator="\n")
        for s in stubs:
            writer.writerow(
                [
                    s["product_id"],
                    f"{s['mrp']:.2f}",
                    f"{s['sale_rate']:.2f}",
                    "0.00",
                ]
            )
        tmp_sql = """
        CREATE TEMP TABLE tmp_hist_price (id uuid, mrp numeric, sale_rate numeric, purchase_rate numeric);
        COPY tmp_hist_price FROM STDIN WITH (FORMAT csv);
        UPDATE products p SET
          mrp = t.mrp,
          "saleRate" = t.sale_rate,
          "purchaseRate" = t.purchase_rate,
          unit = COALESCE(p.unit, 'PCS'),
          "updatedAt" = NOW()
        FROM tmp_hist_price t WHERE p.id = t.id;
        DROP TABLE tmp_hist_price;
        """
        proc = subprocess.run(
            [*psql_base(args), "-c", tmp_sql],
            input=buf.getvalue(),
            text=True,
            capture_output=True,
            check=False,
        )
        if proc.returncode != 0:
            print("WARN stub price backfill failed:", proc.stderr or proc.stdout)


def delete_invoices(args: argparse.Namespace, numbers: list[str]) -> int:
    if not numbers:
        return 0
    deleted = 0
    chunk_size = 400
    for i in range(0, len(numbers), chunk_size):
        chunk = numbers[i : i + chunk_size]
        vals = ",".join("'" + n.replace("'", "''") + "'" for n in chunk)
        sql = f"""
        WITH doomed AS (
          SELECT id FROM order_invoices
          WHERE "tenantId" = '{TENANT_ID}' AND "invoiceNumber" IN ({vals})
        ),
        di AS (DELETE FROM order_items WHERE "orderId" IN (SELECT id FROM doomed)),
        d AS (DELETE FROM order_invoices WHERE id IN (SELECT id FROM doomed) RETURNING id)
        SELECT COUNT(*) FROM d;
        """
        proc = pg_exec(args, sql, check=False)
        if proc.returncode != 0:
            raise RuntimeError(f"Delete invoices failed:\n{proc.stderr or proc.stdout}")
        try:
            deleted += int((proc.stdout or "0").strip().splitlines()[-1])
        except (ValueError, IndexError):
            pass
    return deleted


def table_columns(args: argparse.Namespace, table: str) -> set[str]:
    proc = pg_exec(
        args,
        "COPY ("
        " SELECT column_name FROM information_schema.columns"
        f" WHERE table_name = '{table}'"
        ") TO STDOUT WITH (FORMAT csv);",
        check=False,
    )
    if proc.returncode != 0:
        raise RuntimeError(f"Column lookup failed for {table}:\n{proc.stderr or proc.stdout}")
    return {line.strip() for line in (proc.stdout or "").splitlines() if line.strip()}


def filter_rows(rows: list[dict], columns: list[str]) -> list[dict]:
    return [{c: row.get(c) for c in columns} for row in rows]


def insert_invoices(args: argparse.Namespace, bills: list[dict]) -> None:
    inv_cols_available = table_columns(args, "order_invoices")
    item_cols_available = table_columns(args, "order_items")

    invoice_rows = []
    item_rows = []
    for bill in bills:
        lines = bill.get("resolved_lines") or []
        if not lines:
            continue
        created = bill["bill_date"].astimezone(timezone.utc).isoformat()
        payload = json.dumps(
            {"name": bill["customer_name"], "phone": bill["customer_mobile"] or ""},
            ensure_ascii=False,
        )
        invoice_rows.append(
            {
                "id": bill["id"],
                "tenantId": TENANT_ID,
                "facilityId": FACILITY_ID,
                "cashierId": CASHIER_ID,
                "customerPayload": payload,
                "subtotal": f"{bill['subtotal']:.2f}",
                "taxTotal": "0.00",
                "discountTotal": "0.00",
                "invoiceNumber": bill["invoice_number"],
                "saleType": "CASH_SALE",
                "status": "COMPLETED",
                "customerMobile": bill["customer_mobile"] or r"\N",
                "taxableValue": f"{bill['subtotal']:.2f}",
                "redeemAmount": "0.00",
                "grossSale": f"{bill['subtotal']:.2f}",
                "roundOff": "0.00",
                "couponCode": r"\N",
                "billDiscountPercent": "0.00",
                "amountTendered": f"{bill['subtotal']:.2f}",
                "changeDue": "0.00",
                "returnOfInvoiceId": r"\N",
                "cashierName": "CNP MART",
                "finalPayable": f"{bill['subtotal']:.2f}",
                "paymentChannel": "CASH",
                "originSource": "OFFLINE_POS",
                "isSynced": "t",
                "createdAt": created,
                "updatedAt": created,
            }
        )
        for line in lines:
            item_rows.append(
                {
                    "id": line["id"],
                    "orderId": bill["id"],
                    "productId": line["product_id"],
                    "lotId": line["lot_id"],
                    "quantity": line["quantity"],
                    "unitPrice": f"{line['unit_price']:.2f}",
                    "barcode": line["barcode"] or r"\N",
                    "batchNumber": r"\N",
                    "mrp": f"{line['mrp']:.2f}",
                    "discountPercent": "0.00",
                    "discountAmount": "0.00",
                    "calculatedTax": "0.00",
                    "netAmount": f"{line['net_amount']:.2f}",
                    "createdAt": created,
                }
            )

    preferred_invoice_cols = [
        "id",
        "tenantId",
        "facilityId",
        "cashierId",
        "customerPayload",
        "subtotal",
        "taxTotal",
        "discountTotal",
        "invoiceNumber",
        "saleType",
        "status",
        "customerMobile",
        "taxableValue",
        "redeemAmount",
        "grossSale",
        "roundOff",
        "couponCode",
        "billDiscountPercent",
        "amountTendered",
        "changeDue",
        "returnOfInvoiceId",
        "cashierName",
        "finalPayable",
        "paymentChannel",
        "originSource",
        "isSynced",
        "createdAt",
        "updatedAt",
    ]
    preferred_item_cols = [
        "id",
        "orderId",
        "productId",
        "lotId",
        "quantity",
        "unitPrice",
        "barcode",
        "batchNumber",
        "mrp",
        "discountPercent",
        "discountAmount",
        "calculatedTax",
        "netAmount",
        "createdAt",
    ]
    invoice_cols = [c for c in preferred_invoice_cols if c in inv_cols_available]
    item_cols = [c for c in preferred_item_cols if c in item_cols_available]
    missing_inv = [c for c in preferred_invoice_cols if c not in inv_cols_available]
    missing_item = [c for c in preferred_item_cols if c not in item_cols_available]
    if missing_inv:
        print("Postgres: skipping missing order_invoices cols:", ", ".join(missing_inv))
    if missing_item:
        print("Postgres: skipping missing order_items cols:", ", ".join(missing_item))

    print(f"Postgres: inserting {len(invoice_rows)} invoices / {len(item_rows)} lines…")
    copy_csv(args, "order_invoices", invoice_cols, filter_rows(invoice_rows, invoice_cols))
    copy_csv(args, "order_items", item_cols, filter_rows(item_rows, item_cols))


def import_pos(args: argparse.Namespace, bills: list[dict], stubs: list[dict]) -> None:
    db_path = args.pos_db
    if not db_path.exists():
        raise FileNotFoundError(f"POS database not found: {db_path}")

    print(f"POS SQLite: updating {db_path}")
    conn = sqlite3.connect(str(db_path))
    try:
        conn.execute("PRAGMA foreign_keys = ON")
        # Ensure stub products exist locally if products_local table exists
        if stubs:
            for s in stubs:
                conn.execute(
                    """
                    INSERT OR IGNORE INTO product_lots_local (
                      id, product_id, product_name, product_sku, base_barcode,
                      company, size, color, hsn_code,
                      batch_number, cost_price, mrp, sale_rate,
                      manufacture_date, expiry_date, lot_barcode,
                      quantity_on_hand, aisle_shelf_location, facility_id, updated_at
                    ) VALUES (
                      ?, ?, ?, ?, ?,
                      '', '', '', '',
                      ?, ?, ?, ?,
                      ?, ?, ?,
                      0, NULL, ?, datetime('now')
                    )
                    """,
                    (
                        s["lot_id"],
                        s["product_id"],
                        s["name"],
                        s["sku"],
                        s["base_barcode"],
                        s["batch_number"],
                        s["cost_price"],
                        s["mrp"],
                        s["sale_rate"],
                        s["manufacture_date"],
                        s["expiry_date"],
                        s["lot_barcode"],
                        FACILITY_ID,
                    ),
                )

        numbers = [b["invoice_number"] for b in bills if b.get("resolved_lines")]
        if numbers:
            placeholders = ",".join("?" for _ in numbers)
            ids = [
                r[0]
                for r in conn.execute(
                    f"SELECT id FROM order_invoices_local WHERE invoice_number IN ({placeholders})",
                    numbers,
                ).fetchall()
            ]
            if ids:
                id_ph = ",".join("?" for _ in ids)
                conn.execute(f"DELETE FROM order_items_local WHERE order_id IN ({id_ph})", ids)
                conn.execute(f"DELETE FROM order_invoices_local WHERE id IN ({id_ph})", ids)

        for bill in bills:
            lines = bill.get("resolved_lines") or []
            if not lines:
                continue
            created = bill["bill_date"].astimezone(timezone.utc).strftime("%Y-%m-%dT%H:%M:%S.000Z")
            payload = json.dumps(
                {"name": bill["customer_name"], "phone": bill["customer_mobile"] or ""},
                ensure_ascii=False,
            )
            conn.execute(
                """
                INSERT INTO order_invoices_local (
                  id, invoice_number, tenant_id, facility_id, cashier_id, cashier_name,
                  sale_type, status, customer_payload, customer_mobile,
                  subtotal, taxable_value, tax_total, discount_total, redeem_amount,
                  gross_sale, round_off, final_payable, payment_channel,
                  amount_tendered, change_due, origin_source, is_synced, created_at
                ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 0, 0, 0, ?, 0, ?, 'CASH', ?, 0, 'OFFLINE_POS', 1, ?)
                """,
                (
                    bill["id"],
                    bill["invoice_number"],
                    TENANT_ID,
                    FACILITY_ID,
                    CASHIER_ID,
                    "CNP MART",
                    "CASH_SALE",
                    "COMPLETED",
                    payload,
                    bill["customer_mobile"] or "",
                    bill["subtotal"],
                    bill["subtotal"],
                    bill["subtotal"],
                    bill["subtotal"],
                    bill["subtotal"],
                    created,
                ),
            )
            for line in lines:
                conn.execute(
                    """
                    INSERT INTO order_items_local (
                      id, order_id, product_id, lot_id, barcode, quantity, mrp, unit_price,
                      discount_percent, discount_amount, calculated_tax, net_amount
                    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, 0, 0, 0, ?)
                    """,
                    (
                        line["id"],
                        bill["id"],
                        line["product_id"],
                        line["lot_id"],
                        line["barcode"] or "",
                        line["quantity"],
                        line["mrp"],
                        line["unit_price"],
                        line["net_amount"],
                    ),
                )
        conn.commit()
        count = conn.execute("SELECT COUNT(*) FROM order_invoices_local").fetchone()[0]
        print(f"POS SQLite: invoices now {count}")
    finally:
        conn.close()


def print_stats(stats: dict, stubs: list[dict], bills: list[dict]) -> None:
    matched = stats["matched_barcode"] + stats["matched_name"]
    print("\n=== Import plan ===")
    print(f"Bills:              {stats['bills']}")
    print(f"Lines:              {stats['lines']}")
    print(f"Net total:          ₹{stats['net_total']:,.2f}")
    print(f"Matched barcode:    {stats['matched_barcode']}")
    print(f"Matched name:       {stats['matched_name']}")
    print(f"Stubbed lines:      {stats['stubbed']}")
    print(f"Stub SKUs:          {stats['stub_skus']}")
    print(f"Match rate:         {100 * matched / max(1, stats['lines']):.1f}%")
    empty = sum(1 for b in bills if not b.get("resolved_lines"))
    if empty:
        print(f"Empty bills skipped:{empty}")
    if stubs:
        print("Sample stubs:")
        for s in stubs[:8]:
            print(f"  - {s['sku']}: {s['name'][:60]}")


def main() -> int:
    args = parse_args()
    if args.railway:
        args.skip_pos = True
        if not args.database_url:
            print("ERROR: --railway requires DATABASE_URL", file=sys.stderr)
            return 1
    if args.no_replace:
        args.replace = False

    if not args.xlsx.exists():
        print(f"Missing sheet: {args.xlsx}", file=sys.stderr)
        return 1

    print(f"Reading {args.xlsx} …")
    records = load_sale_rows(args.xlsx)
    print(f"Parsed {len(records)} sale lines")
    bills = group_bills(records)
    print(f"Grouped into {len(bills)} bills")

    if args.skip_postgres and args.dry_run:
        # dry-run without DB: cannot match; stub everything
        by_barcode, by_name = {}, {}
    else:
        if args.skip_postgres and not args.dry_run:
            print("ERROR: need Postgres for product matching unless --dry-run with empty catalog", file=sys.stderr)
            return 1
        print("Loading product catalog from Postgres…")
        by_barcode, by_name = load_catalog(args)
        print(f"Catalog: {len(by_barcode)} barcodes, {len(by_name)} names")

    bills, stubs, stats = resolve_lines(bills, by_barcode, by_name)
    print_stats(stats, stubs, bills)

    if args.dry_run:
        print("\nDry-run only — no writes.")
        return 0

    write_bills = [b for b in bills if b.get("resolved_lines")]
    numbers = [b["invoice_number"] for b in write_bills]

    if not args.skip_postgres:
        existing = existing_invoice_numbers(args, numbers)
        if existing and not args.replace:
            before = len(write_bills)
            write_bills = [b for b in write_bills if b["invoice_number"] not in existing]
            # filter stubs to those still referenced
            used_products = {l["product_id"] for b in write_bills for l in b["resolved_lines"]}
            stubs = [s for s in stubs if s["product_id"] in used_products]
            print(f"Skipping {before - len(write_bills)} existing invoices (--no-replace)")
        elif existing and args.replace:
            print(f"Replacing {len(existing)} existing invoices…")
            deleted = delete_invoices(args, list(existing))
            print(f"Deleted {deleted} prior invoices")

        # Only insert stubs that do not already exist
        if stubs:
            skus = ",".join("'" + s["sku"].replace("'", "''") + "'" for s in stubs)
            proc = pg_exec(
                args,
                f"COPY (SELECT sku FROM products WHERE sku IN ({skus})) TO STDOUT WITH (FORMAT csv);",
                check=False,
            )
            existing_skus = {line.strip() for line in (proc.stdout or "").splitlines() if line.strip()}
            new_stubs = [s for s in stubs if s["sku"] not in existing_skus]
            insert_stubs(args, new_stubs)

        insert_invoices(args, write_bills)
        verify = pg_exec(
            args,
            f"""
            SELECT
              COUNT(*) AS bills,
              COALESCE(SUM("finalPayable"),0) AS net
            FROM order_invoices
            WHERE "tenantId" = '{TENANT_ID}'
              AND "invoiceNumber" LIKE '2026-2027/%';
            """,
        )
        print("Postgres verify:", (verify.stdout or "").strip())

    if not args.skip_pos:
        import_pos(args, write_bills, stubs)

    print("Done.")
    return 0


if __name__ == "__main__":
    sys.exit(main())
