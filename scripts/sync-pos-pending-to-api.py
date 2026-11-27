#!/usr/bin/env python3
"""Push unsynced COMPLETED POS invoices to the central API via /api/v1/sync/push."""

from __future__ import annotations

import argparse
import json
import os
import sqlite3
import sys
import urllib.error
import urllib.request
from pathlib import Path

TENANT_ID = "00000000-0000-0000-0000-000000000001"
FACILITY_ID = "00000000-0000-0000-0000-000000000002"
# Railway users table has cashier …0003; POS may store manager …0006 locally.
CASHIER_ID = "00000000-0000-0000-0000-000000000003"


def parse_args() -> argparse.Namespace:
    p = argparse.ArgumentParser(description=__doc__)
    p.add_argument(
        "--pos-db",
        type=Path,
        default=Path.home() / ".config" / "mart-pos-terminal" / "data" / "mart-pos.db",
    )
    p.add_argument(
        "--api",
        default=os.environ.get("RAILWAY_API_URL", "https://mart-production-cdeb28ec.up.railway.app"),
    )
    p.add_argument("--mark-synced", action="store_true", default=True)
    p.add_argument("--no-mark-synced", action="store_true")
    return p.parse_args()


def load_pending(conn: sqlite3.Connection) -> tuple[dict, list[dict]]:
    cfg = {r[0]: r[1] for r in conn.execute("SELECT key, value FROM pos_config")}
    rows = conn.execute(
        """
        SELECT * FROM order_invoices_local
        WHERE is_synced = 0 AND status = 'COMPLETED'
        ORDER BY created_at ASC
        """
    ).fetchall()
    cols = [d[0] for d in conn.execute("SELECT * FROM order_invoices_local LIMIT 0").description]
    invoices = []
    for row in rows:
        inv = dict(zip(cols, row))
        items = conn.execute(
            """
            SELECT id, product_id, lot_id, barcode, batch_number, quantity, unit_price,
                   mrp, discount_percent, discount_amount, calculated_tax, net_amount
            FROM order_items_local WHERE order_id = ?
            """,
            (inv["id"],),
        ).fetchall()
        item_cols = [
            "id",
            "productId",
            "lotId",
            "barcode",
            "batchNumber",
            "quantity",
            "unitPrice",
            "mrp",
            "discountPercent",
            "discountAmount",
            "calculatedTax",
            "netAmount",
        ]
        payload = inv.get("customer_payload") or "{}"
        try:
            customer_payload = json.loads(payload) if isinstance(payload, str) else payload
        except json.JSONDecodeError:
            customer_payload = {"name": "Walk-in", "phone": ""}

        # Minimal payload: Railway may still run an older SyncOrderInvoiceDto
        # that rejects newer optional fields as "excess property".
        invoices.append(
            {
                "id": inv["id"],
                "tenantId": inv["tenant_id"],
                "facilityId": inv["facility_id"],
                "cashierId": CASHIER_ID,
                "customerPayload": customer_payload,
                "subtotal": inv["subtotal"],
                "taxTotal": inv["tax_total"],
                "discountTotal": inv.get("discount_total") or 0,
                "finalPayable": inv["final_payable"],
                "paymentChannel": inv["payment_channel"],
                "originSource": inv.get("origin_source") or "OFFLINE_POS",
                "createdAt": inv["created_at"],
                "items": [
                    {
                        "id": it[0],
                        "productId": it[1],
                        "lotId": it[2],
                        "quantity": it[5],
                        "unitPrice": it[6],
                        "calculatedTax": it[10],
                        "netAmount": it[11],
                    }
                    for it in items
                ],
            }
        )
    return cfg, invoices


def post_sync(api: str, body: dict) -> dict:
    req = urllib.request.Request(
        f"{api.rstrip('/')}/api/v1/sync/push",
        data=json.dumps(body).encode("utf-8"),
        method="POST",
        headers={
            "Content-Type": "application/json",
            "X-Tenant-Id": body["tenantId"],
        },
    )
    try:
        with urllib.request.urlopen(req, timeout=120) as resp:
            raw = resp.read().decode("utf-8")
            return json.loads(raw) if raw else {}
    except urllib.error.HTTPError as exc:
        detail = exc.read().decode("utf-8", errors="replace")
        raise RuntimeError(f"HTTP {exc.code}: {detail}") from exc


def main() -> int:
    args = parse_args()
    if args.no_mark_synced:
        args.mark_synced = False
    if not args.pos_db.exists():
        print(f"POS DB missing: {args.pos_db}", file=sys.stderr)
        return 1

    conn = sqlite3.connect(str(args.pos_db))
    try:
        cfg, invoices = load_pending(conn)
        api = (cfg.get("apiBaseUrl") or args.api).rstrip("/")
        tenant_id = cfg.get("tenantId") or TENANT_ID
        facility_id = cfg.get("facilityId") or FACILITY_ID
        device_id = cfg.get("deviceId") or "POS-TERMINAL-001"

        print(f"API: {api}")
        print(f"Pending COMPLETED unsynced invoices: {len(invoices)}")
        if not invoices:
            print("Nothing to sync.")
            return 0

        for inv in invoices:
            print(f"  - ₹{inv['finalPayable']} ({inv['id']})")

        body = {
            "tenantId": tenant_id,
            "facilityId": facility_id,
            "deviceId": device_id,
            "invoices": invoices,
        }
        result = post_sync(api, body)
        print("Sync response:", json.dumps(result, indent=2)[:2000])

        accepted_ids = []
        for r in result.get("results") or []:
            status = r.get("status")
            cid = r.get("clientEventId")
            print(f"  {cid}: {status} — {r.get('message')}")
            if status in ("ACCEPTED", "DUPLICATE") and cid:
                accepted_ids.append(cid)

        if args.mark_synced and accepted_ids:
            placeholders = ",".join("?" for _ in accepted_ids)
            conn.execute(
                f"UPDATE order_invoices_local SET is_synced = 1 WHERE id IN ({placeholders})",
                accepted_ids,
            )
            conn.commit()
            print(f"Marked {len(accepted_ids)} invoices synced locally.")
    finally:
        conn.close()
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
