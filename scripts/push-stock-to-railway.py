#!/usr/bin/env python3
"""Push CNP stock sheet to Railway via /api/v1/admin/import-stock (uses internal DB)."""

from __future__ import annotations

import argparse
import json
import os
import sys
import urllib.error
import urllib.request
import xml.etree.ElementTree as ET
import zipfile
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
        default=root / "data" / "STOCK_ANALYSIS_SHEET_20261126143124.xlsx",
    )
    p.add_argument("--batch-size", type=int, default=150)
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


def load_items(xlsx: Path) -> list[dict]:
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

    header_cells = row_cells(rows[1], shared)
    cols = sorted(header_cells.keys(), key=lambda x: (len(x), x))
    headers = {c: str(header_cells[c]) for c in cols}

    items = []
    for row in rows[2:]:
        cells = row_cells(row, shared)
        if not cells:
            continue
        rec = {headers[c]: cells.get(c) for c in cols}
        if rec.get("Item_ID") is None or not str(rec.get("Item Name") or "").strip():
            continue

        item_id = int(rec["Item_ID"])
        qty = max(0, int(round(float(rec.get("Closing Qty") or 0))))
        mrp = float(rec.get("MRP") or 0)
        rate = float(rec.get("Rate") or mrp)
        avg = float(rec.get("AVG Closing Purchase Value") or 0)
        closing_val = float(rec.get("Closing Purchase Value") or 0)
        if avg <= 0 and qty > 0 and closing_val > 0:
            avg = closing_val / qty
        barcode = str(rec.get("Barcode") or "").strip() or f"CNP-{item_id}"
        if len(barcode) > 32:
            barcode = f"CNP-{item_id}"

        items.append(
            {
                "itemId": item_id,
                "name": str(rec.get("Item Name")).strip()[:512],
                "barcode": barcode,
                "brand": (str(rec.get("Brand")).strip() if rec.get("Brand") else None),
                "size": (str(rec.get("Size")).strip() if rec.get("Size") else None),
                "color": (str(rec.get("Colour")).strip() if rec.get("Colour") else None),
                "mrp": round(mrp, 2),
                "saleRate": round(rate if rate > 0 else mrp, 2),
                "costPrice": round(max(0.0, avg), 2),
                "quantityOnHand": qty,
            }
        )
    return items


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
        with urllib.request.urlopen(req, timeout=180) as resp:
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

    items = load_items(args.xlsx)
    print(f"Loaded {len(items)} items; uploading in batches of {args.batch_size}…")

    for start in range(0, len(items), args.batch_size):
        batch = items[start : start + args.batch_size]
        clear = start == 0
        result = api_json(
            "POST",
            f"{args.api.rstrip('/')}/api/v1/admin/import-stock",
            args.secret,
            {"clearExisting": clear, "items": batch},
        )
        print(
            f"  batch {start // args.batch_size + 1}: "
            f"imported={result.get('imported')} stats={result.get('stats')}"
        )

    stats = api_json("GET", f"{args.api.rstrip('/')}/api/v1/admin/import-stats", args.secret)
    print("Final:", stats)
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
