# Mart Omnichannel Retail Ecosystem

Multi-tenant, offline-first omnichannel retail platform with lot tracking, delta-sync inventory, and expiry analytics.

## Prerequisites

| Tool | Version | Purpose |
|------|---------|---------|
| **Node.js** | **20 LTS** (not 23+) | All apps — use `nvm use` (see `.nvmrc`) |
| **Docker** | Latest | PostgreSQL 15 + Redis 7 |
| **npm** | 9+ | Package management |

For the **POS desktop app**, you also need build tools for native modules:

```bash
# Ubuntu/Debian
sudo apt update
sudo apt install -y build-essential python3-setuptools
```

**Use Node 20 LTS** (Node 26 will fail to compile `better-sqlite3`):

```bash
nvm install 20
nvm use 20
```

---

## One-Time Setup

From the project root (`mart/`):

```bash
# Start infrastructure (uses sudo automatically if needed)
npm run infra:up

# One-time setup (install, build, seed, configure env)
npm run setup
```

> **Docker permission note:** If you see `permission denied` on `/var/run/docker.sock`, either:
> - Run `sudo docker compose up -d` first, then `npm run setup` (setup will detect running containers), or
> - Add your user to the docker group permanently:
>   ```bash
>   sudo usermod -aG docker $USER
>   newgrp docker   # or log out and back in
>   ```

---

## Running the POS (Important)

**The POS is a desktop Electron app — NOT a browser URL.**

Opening `http://localhost:5175` in Chrome/Firefox shows a blank page or warning. That is expected.

```bash
cd "/home/sachin/Documents/SELF MADE/mart"
nvm use 20
npm run pos:dev
```

An **Electron window** opens with:
1. **Login screen** — select center, enter username/password
2. **Billing screen** — full retail POS (cash/credit sale, GST totals, customer lookup, save & print)

### Demo POS logins

| User | Password | Role |
|------|----------|------|
| `cashier` | `admin123` | Cashier |
| `manager` | `manager123` | Store Manager |

### Test barcodes at register

| Barcode | Result |
|---------|--------|
| `8901234567890` | Milk — multi-MRP selection |
| `LOT-MILK-001` | Direct lot scan |
| `8909876543210` | Rice — single price |
| Customer mobile `9876543210` | Loads Rahul Sharma (₹450 previous due) |

---

## Running the Stack

Open **4 separate terminals** from the project root:

### Terminal 1 — API Server
```bash
npm run backend:start
```
- Swagger UI: http://localhost:3000/api/docs
- Health check: http://localhost:3000/api/v1/health

### Terminal 2 — Admin Portal (Expiry Dashboard)
```bash
npm run admin:dev
```
- Open: http://localhost:5173

### Terminal 3 — Client Storefront
```bash
npm run store:dev
```
- Open: http://localhost:5174

### Terminal 4 — Desktop POS Terminal
```bash
npm run pos:dev
```
- Electron window opens automatically
- Works offline; syncs to API when online

---

## Manual Setup (Step by Step)

If you prefer running each step yourself:

### Step 1 — Start Infrastructure
```bash
docker compose up -d
```

Wait until healthy:
```bash
docker compose ps
```

| Service | URL / Port |
|---------|-----------|
| PostgreSQL | `localhost:5432` |
| Redis | `localhost:6379` |
| Adminer (DB UI) | http://localhost:8080 |

Adminer login: System **PostgreSQL**, Server **postgres**, User **mart_admin**, Password **mart_secure_pass_2026**, Database **mart_omnichannel**

### Step 2 — Build & Seed API
```bash
cd central-backend
cp .env.example .env        # skip if .env exists
npm install
npm run build               # generates TSOA routes + compiles TypeScript
npm run seed                # inserts demo tenant, products, lots
npm start
```

### Step 3 — Admin Portal
```bash
cd web-apps/admin-portal
cp .env.example .env
npm install
npm run dev
```

### Step 4 — Storefront
```bash
cd web-apps/client-storefront
cp .env.example .env
npm install
npm run dev
```

### Step 5 — POS Terminal
```bash
cd desktop-app
cp .env.example .env
npm install
npm run rebuild             # compile better-sqlite3 for Electron
npm run dev
```

---

## Demo Data

All apps share these fixed IDs (already in `.env` files):

| Entity | UUID |
|--------|------|
| Tenant | `00000000-0000-0000-0000-000000000001` |
| Facility | `00000000-0000-0000-0000-000000000002` |
| Cashier | `00000000-0000-0000-0000-000000000003` |

**Test barcodes** (scan in POS or Storefront):

| Barcode | Product | Behavior |
|---------|---------|----------|
| `8901234567890` | Organic Whole Milk 1L | Multi-MRP popup (₹62 FIFO vs ₹68) |
| `LOT-MILK-001` | Milk lot direct | Composite tag — instant lot binding |
| `8909876543210` | Premium Basmati Rice 5kg | Single MRP |

**Cashier login:** `cashier@demo-mart.local` / `admin123`

---

## Verify Everything Works

```bash
# 1. API health
curl http://localhost:3000/api/v1/health

# 2. Barcode resolution
curl -H "X-Tenant-Id: 00000000-0000-0000-0000-000000000001" \
  "http://localhost:3000/api/v1/barcode/resolve/8901234567890?tenantId=00000000-0000-0000-0000-000000000001&facilityId=00000000-0000-0000-0000-000000000002"

# 3. Expiry dashboard
curl -H "X-Tenant-Id: 00000000-0000-0000-0000-000000000001" \
  http://localhost:3000/api/v1/analytics/expiry/00000000-0000-0000-0000-000000000001
```

---

## Troubleshooting

### `Cannot find module './routes/routes'`
The TSOA routes were not compiled. Fix:
```bash
cd central-backend && npm run build
```

### `connect ECONNREFUSED 127.0.0.1:5432`
PostgreSQL is not running:
```bash
docker compose up -d
docker compose ps   # wait until postgres shows "healthy"
```

### POS app crashes on startup (`better-sqlite3` error)

This usually means wrong Node version or missing Python build tools.

```bash
# 1. Switch to Node 20 LTS
nvm install 20 && nvm use 20

# 2. Install compile dependencies (fixes "No module named 'distutils'")
sudo apt install -y build-essential python3-setuptools

# 3. Clean reinstall POS native modules
cd desktop-app
rm -rf node_modules
cd ..
npm run pos:install
```

### Admin portal shows "Failed to fetch"
Ensure the API is running on port 3000 and demo data is seeded:
```bash
cd central-backend && npm run seed
```

### Re-seed demo data
```bash
# Drop and recreate (development only)
docker compose down -v
docker compose up -d
cd central-backend && npm run build && npm run seed
```

---

## Cloud deploy

See **[DEPLOY.md](./DEPLOY.md)** for step-by-step production hosting (VPS Docker or PaaS).

Quick local prod-stack smoke test (after copying `.env.production.example` → `.env.production`):

```bash
npm run prod:up
npm run prod:ps
```

## Architecture

```
mart/
├── docker-compose.yml          # Dev: PostgreSQL 15, Redis 7, Adminer
├── docker-compose.prod.yml     # Prod-style API + web + DB stack
├── DEPLOY.md                   # Cloud deploy guide
├── scripts/setup.sh            # One-time setup script
├── central-backend/            # TSOA + TypeORM API (port 3000)
├── web-apps/
│   ├── admin-portal/           # Expiry dashboard (port 5173)
│   └── client-storefront/      # B2C storefront (port 5174)
└── desktop-app/                # Electron offline POS
```

## Offline Sync Flow

1. POS creates invoices locally (`isSynced = 0`)
2. Background worker polls connectivity every 10 seconds
3. When online, pushes to `POST /api/v1/sync/push`
4. Server applies idempotent delta stock reduction
5. Local rows marked `isSynced = 1` atomically
