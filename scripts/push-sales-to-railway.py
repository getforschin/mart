#!/usr/bin/env python3
"""Push itemwise sale Excel to Railway via /api/v1/admin/import-historical-sales.

Requires the Railway API to include the historical-sales endpoint (deploy this repo first).
Does NOT adjust stock — matches opening-stock-already-loaded workflow.
"""

from __future__ import annotations

import argparse
import json
import os
import sys
import urllib.error
import urllib.request
import xml.etree.ElementTree as ET
import zipfile
from collections import OrderedDict
from pathlib import Path

NS = {"m": "http://schemas.openxmlformats.org/spreadsheetml/2006/main"}


def parse_args() -> argparse.Namespace:
    root = Path(__file__).resolve().parents[1]
    p = argparse.ArgumentParser(description=__doc__)
    p.add_argument(
        "--api",
        default=os.environ.get("RAILWAY_API_URL", "https://mart-production-cdeb28ec.up.railway.app"),
    )
    p.add_argument(
        "--secret",
        default=os.environ.get("IMPORT_SECRET", "cnp-import-2026"),
        help="Must match Railway API service env IMPORT_SECRET",
    )
    p.add_argument(
        "--xlsx",
        type=Path,
        default=root / "sale_report_itemwise_sale_20261127152241.xlsx",
    )
    p.add_argument("--batch-size", type=int, default=40, help="Invoices per HTTP request")
    p.add_argument(
        "--no-replace",
        action="store_true",
        help="Skip invoices that already exist on the server",
    )
    return p.parse_args()


def cell_value(cell, shared):
    t = cell.get("t")
    v = cell.find("m:v", NS)
    if v is None or v.text is None:
        return None
    if t == "s":
        return shared[int(v.text)]
    try:
        if "." in v.text:
            return float(v.text)
        return int(v.text)
    except ValueError:
        return v.text


def row_cells(row, shared):
    out = {}
    for cell in row.findall("m:c", NS):
        ref = cell.get("r", "")
        col = "".join(ch for ch in ref if ch.isalpha())
        out[col] = cell_value(cell, shared)
    return out


def to_float(value, default=0.0):
    try:
        if value is None or value == "":
            return default
        return float(value)
    except (TypeError, ValueError):
        return default


def clean_barcode(value) -> str:
    if value is None:
        return ""
    text = str(value).strip()
    if text.endswith(".0") and text[:-2].isdigit():
        text = text[:-2]
    return text


def load_invoices(xlsx: Path) -> list[dict]:
    with zipfile.ZipFile(xlsx) as zf:
        shared = []
        for si in ET.fromstring(zf.read("xl/sharedStrings.xml")).findall("m:si", NS):
            shared.append(
                "".join(
                    t.text or ""
                    for t in si.iter("{http://schemas.openxmlformats.org/spreadsheetml/2006/main}t")
                )
            )
        rows = ET.fromstring(zf.read("xl/worksheets/sheet1.xml")).findall("m:sheetData/m:row", NS)

    header_idx = None
    headers = {}
    for i, row in enumerate(rows):
        cells = row_cells(row, shared)
        vals = {str(v).strip() for v in cells.values() if v is not None}
        if "Bill_Number" in vals and "Item_Name" in vals:
            header_idx = i
            cols = sorted(cells.keys(), key=lambda x: (len(x), x))
            headers = {c: str(cells[c]).strip() for c in cols if cells.get(c) is not None}
            break
    if header_idx is None:
        raise RuntimeError("Could not find Bill_Number / Item_Name header row")

    groups: OrderedDict[str, dict] = OrderedDict()
    for row in rows[header_idx + 1 :]:
        cells = row_cells(row, shared)
        if not cells:
            continue
        rec = {headers[c]: cells.get(c) for c in headers}
        if str(rec.get("ID") or "").strip().lower() == "total":
            continue
        bill = str(rec.get("Bill_Number") or "").strip()[:32]
        name = str(rec.get("Item_Name") or "").strip()
        if not bill or not name:
            continue
        qty = int(round(to_float(rec.get("Qty"))))
        if qty <= 0:
            continue
        if bill not in groups:
            groups[bill] = {
                "invoiceNumber": bill,
                "billDate": str(rec.get("Bill_Date") or "")[:10],
                "customerName": str(rec.get("Customer_Name") or "Walk-in").strip() or "Walk-in",
                "customerMobile": clean_barcode(rec.get("Customer_Mobile"))[:20],
                "lines": [],
            }
        name_cust = str(rec.get("Customer_Name") or "").strip()
        if name_cust and name_cust.upper() != "CNP MART":
            groups[bill]["customerName"] = name_cust
            mobile = clean_barcode(rec.get("Customer_Mobile"))[:20]
            if mobile:
                groups[bill]["customerMobile"] = mobile

        unit = round(to_float(rec.get("Saleprice")), 2)
        mrp = round(to_float(rec.get("Mrp"), unit), 2)
        net = round(to_float(rec.get("Net_Amount"), unit * qty), 2)
        groups[bill]["lines"].append(
            {
                "externalLineId": rec.get("ID"),
                "itemName": name[:512],
                "barcode": clean_barcode(rec.get("Barcode")) or None,
                "quantity": qty,
                "unitPrice": unit,
                "mrp": mrp,
                "netAmount": net,
            }
        )
    return list(groups.values())


def api_json(method: str, url: str, secret: str, body: dict | None = None) -> dict:
    data = None if body is None else json.dumps(body).encode("utf-8")
    req = urllib.request.Request(
        url,
        data=data,
        method=method,
        headers={
            "Content-Type": "application/json",
            "x-import-secret": secret,
        },
    )
    try:
        with urllib.request.urlopen(req, timeout=300) as resp:
            raw = resp.read().decode("utf-8")
            return json.loads(raw) if raw else {}
    except urllib.error.HTTPError as exc:
        detail = exc.read().decode("utf-8", errors="replace")
        raise RuntimeError(f"HTTP {exc.code} {url}: {detail}") from exc


def main() -> int:
    args = parse_args()
    if not args.xlsx.exists():
        print(f"Missing {args.xlsx}", file=sys.stderr)
        return 1

    print(f"API: {args.api}")
    print("Bootstrapping tenant…")
    boot = api_json("POST", f"{args.api.rstrip('/')}/api/v1/admin/bootstrap", args.secret, {})
    print(boot)

    invoices = load_invoices(args.xlsx)
    total_lines = sum(len(i["lines"]) for i in invoices)
    print(f"Loaded {len(invoices)} invoices / {total_lines} lines; batches of {args.batch_size}…")

    replace = not args.no_replace
    for start in range(0, len(invoices), args.batch_size):
        batch = invoices[start : start + args.batch_size]
        result = api_json(
            "POST",
            f"{args.api.rstrip('/')}/api/v1/admin/import-historical-sales",
            args.secret,
            {"replaceExisting": replace, "invoices": batch},
        )
        print(
            f"  batch {start // args.batch_size + 1}: "
            f"imported={result.get('importedInvoices')} lines={result.get('importedLines')} "
            f"net={result.get('netTotal')} stubs={result.get('stubsCreated')} "
            f"stats={result.get('stats')}"
        )

    stats = api_json("GET", f"{args.api.rstrip('/')}/api/v1/admin/sales-import-stats", args.secret)
    print("Final:", stats)
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
