#!/usr/bin/env python3
"""Sync er4u customer report into Railway customers table via parties API."""

from __future__ import annotations

import argparse
import json
import os
import re
import sys
import urllib.error
import urllib.request
import uuid
from pathlib import Path

TENANT_ID = "00000000-0000-0000-0000-000000000001"
CUSTOMER_NS = uuid.UUID("00000000-0000-4000-8000-00000000c010")


def parse_args() -> argparse.Namespace:
    root = Path(__file__).resolve().parents[1]
    p = argparse.ArgumentParser(description=__doc__)
    p.add_argument(
        "--api",
        default=os.environ.get("RAILWAY_API_URL", "https://mart-production-cdeb28ec.up.railway.app"),
    )
    p.add_argument(
        "--xls",
        type=Path,
        default=root / "data" / "er4u_CustomerReport20261126.xls",
    )
    return p.parse_args()


def load_customers(path: Path) -> list[dict]:
    text = path.read_text(encoding="utf-8", errors="replace").strip()
    # File is TSV (sometimes labeled .xls)
    lines = [ln for ln in text.splitlines() if ln.strip()]
    if not lines:
        return []
    headers = lines[0].split("\t")
    rows = []
    for line in lines[1:]:
        cols = line.split("\t")
        # pad
        while len(cols) < len(headers):
            cols.append("")
        rec = {headers[i]: cols[i].strip() for i in range(len(headers))}
        name = rec.get("Customer Name") or ""
        mobile = re.sub(r"\D", "", rec.get("Mobile No") or "")
        if not name or not mobile:
            continue
        if len(mobile) > 20:
            mobile = mobile[:20]

        city = rec.get("City") or ""
        pincode = None
        if city.isdigit() and 4 <= len(city) <= 8:
            pincode = city
            city = ""

        cust_id = rec.get("Custid") or mobile
        disc_raw = rec.get("Cust.Wise Disc") or "0"
        try:
            discount = float(disc_raw or 0)
        except ValueError:
            discount = 0.0

        payload: dict = {
            "id": str(uuid.uuid5(CUSTOMER_NS, f"cust-{cust_id}")),
            "name": name[:255],
            "mobile": mobile,
            "membershipCard": f"LEGACY-{cust_id}",
            "discountPercent": discount,
            "priceType": "MRP",
            "creditLimit": 0,
            "isActive": True,
        }
        optional = {
            "email": rec.get("Email") or "",
            "address": rec.get("Address") or "",
            "city": city,
            "state": rec.get("State") or "",
            "pincode": pincode or "",
            "gstin": rec.get("GSTIN") or "",
        }
        for key, value in optional.items():
            if value:
                payload[key] = value
        rows.append(payload)
    return rows


def api_json(method: str, url: str, body: dict | None = None) -> dict:
    data = None if body is None else json.dumps(body).encode("utf-8")
    req = urllib.request.Request(
        url,
        data=data,
        method=method,
        headers={
            "Content-Type": "application/json",
            "x-tenant-id": TENANT_ID,
        },
    )
    try:
        with urllib.request.urlopen(req, timeout=60) as resp:
            raw = resp.read().decode("utf-8")
            return json.loads(raw) if raw else {}
    except urllib.error.HTTPError as exc:
        detail = exc.read().decode("utf-8", errors="replace")
        raise RuntimeError(f"HTTP {exc.code} {url}: {detail}") from exc


def main() -> int:
    args = parse_args()
    if not args.xls.exists():
        print(f"Missing {args.xls}", file=sys.stderr)
        return 1

    customers = load_customers(args.xls)
    print(f"Loaded {len(customers)} customers from {args.xls.name}")
    if not customers:
        return 1

    base = args.api.rstrip("/")
    for c in customers:
        saved = api_json(
            "POST",
            f"{base}/api/v1/parties/customers?tenantId={TENANT_ID}",
            c,
        )
        print(f"  synced {saved.get('membershipCard')} {saved.get('name')} {saved.get('mobile')}")

    listed = api_json("GET", f"{base}/api/v1/parties/customers?tenantId={TENANT_ID}")
    print(f"Railway customers now: {len(listed) if isinstance(listed, list) else listed}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
