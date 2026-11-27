# Cloud deploy guide (Mart)

This guide gets the **API + Admin + Storefront** on the internet.  
The **Windows POS installer** is a later step (Electron packaging).

---

## What you will have after this

| URL | App |
|-----|-----|
| `https://api.yourdomain.com` | Backend API + Swagger |
| `https://admin.yourdomain.com` | Expiry / admin portal |
| `https://shop.yourdomain.com` | Customer storefront |

POS PCs will later sync to `https://api.yourdomain.com`.

---

## Choose a path

### Path A — Easiest for first launch (recommended)

**One VPS** (DigitalOcean / Hetzner / Lightsail) + Docker Compose + Caddy/Nginx for HTTPS.

You already have `docker-compose.prod.yml` in this repo.

### Path B — Managed PaaS

- **API**: Railway / Render / Fly.io  
- **Postgres**: Neon / Supabase / Railway Postgres  
- **Redis**: Upstash / Railway Redis  
- **Admin + Storefront**: Cloudflare Pages / Netlify / Vercel (static)

Use env vars from `.env.production.example` and `central-backend/.env.example`  
(`DATABASE_URL`, `REDIS_URL` are supported).

---

## Path A — Step by step (VPS + Docker)

### 1. Buy domain + VPS

1. Domain (Namecheap, Cloudflare, GoDaddy, etc.)
2. Ubuntu 22.04/24.04 VPS (2 GB RAM minimum; 4 GB better)
3. Point DNS (can wait until step 6):
   - `api` → VPS IP  
   - `admin` → VPS IP  
   - `shop` → VPS IP  

### 2. Prepare the server

SSH in, then:

```bash
sudo apt update && sudo apt install -y docker.io docker-compose-v2 git
sudo usermod -aG docker $USER
# log out and back in
```

### 3. Put the code on the server

```bash
git clone <YOUR_REPO_URL> mart
cd mart
```

Or `scp` / `rsync` the project (avoid paths with spaces on the server; use `/opt/mart`).

### 4. Create production env

```bash
cp .env.production.example .env.production
nano .env.production
```

Set at least:

- Strong `DATABASE_PASSWORD`
- Strong `JWT_SECRET`
- `PUBLIC_API_URL=https://api.yourdomain.com`
- `CORS_ORIGINS=https://admin.yourdomain.com,https://shop.yourdomain.com`
- `TYPEORM_SYNCHRONIZE=true` **for first boot only**

### 5. Start the stack

```bash
docker compose -f docker-compose.prod.yml --env-file .env.production up -d --build
docker compose -f docker-compose.prod.yml --env-file .env.production ps
curl http://127.0.0.1:3000/api/v1/health
```

Seed demo data (optional, from host with Node 20, or run once via a temporary container):

```bash
# After API is healthy — from a machine that can reach the DB, or exec:
docker compose -f docker-compose.prod.yml --env-file .env.production exec api \
  node -e "console.log('API image has no seed CLI; run seed from CI/dev against prod DB carefully')"
```

For a first pilot, seed from your laptop against the production DB **only if** you open DB access briefly, or copy the seed script into a one-off job. Safer: keep `TYPEORM_SYNCHRONIZE=true` for first boot, then create tenants via SQL/Admin later.

### 6. HTTPS reverse proxy (Caddy — simplest)

Install Caddy, then use a Caddyfile like:

```caddy
api.yourdomain.com {
  reverse_proxy 127.0.0.1:3000
}

admin.yourdomain.com {
  reverse_proxy 127.0.0.1:8081
}

shop.yourdomain.com {
  reverse_proxy 127.0.0.1:8082
}
```

```bash
sudo systemctl reload caddy
```

Open:

- https://api.yourdomain.com/api/docs  
- https://admin.yourdomain.com  
- https://shop.yourdomain.com  

### 7. Lock down after first success

1. Set `TYPEORM_SYNCHRONIZE=false` in `.env.production`
2. Restart API:  
   `docker compose -f docker-compose.prod.yml --env-file .env.production up -d api`
3. Do **not** expose Postgres/Redis ports publicly (compose already keeps them internal)
4. Enable firewall: allow 22, 80, 443 only

### 8. Continuous deploy (simple)

On each release:

```bash
cd /opt/mart
git pull
docker compose -f docker-compose.prod.yml --env-file .env.production up -d --build
```

Later: wire GitHub Actions (see `.github/workflows/ci.yml`) to SSH-deploy or push images to a registry.

---

## Path B — Railway (easy) step by step

### 0. Push latest code (includes `central-backend/railway.toml`)

```bash
cd "/home/sachin/Documents/SELF MADE/mart"
git add central-backend/railway.toml DEPLOY.md
git commit -m "Add Railway deploy config for API"
git push origin main
```

### 1. Create Railway project

1. Open [https://railway.app](https://railway.app) → login with **GitHub**
2. **New Project** → **Deploy from GitHub repo** → select `getforschin/mart`
3. If asked for root directory / service settings, set later (step 3)

### 2. Add Postgres + Redis in the same project

1. Click **+ New** → **Database** → **Add PostgreSQL**
2. Click **+ New** → **Database** → **Add Redis**
3. Wait until both show **Online**

### 3. Configure the API service

1. Open the service that deployed from GitHub (or **+ New** → **GitHub Repo** → `mart` if missing)
2. **Settings**:
   - **Root Directory**: `central-backend`
   - **Watch Paths** (optional): `central-backend/**`
3. **Variables** → add:

| Variable | Value |
|----------|--------|
| `NODE_ENV` | `production` |
| `PORT` | `3000` |
| `JWT_SECRET` | long random string |
| `CORS_ORIGINS` | `*` (tighten later) |
| `TYPEORM_SYNCHRONIZE` | `true` (first deploy only) |
| `DATABASE_URL` | click **Add reference** → Postgres `DATABASE_URL` |
| `REDIS_URL` | click **Add reference** → Redis `REDIS_URL` (or `REDIS_PUBLIC_URL`) |

4. **Networking** → **Generate Domain** (gives `https://….up.railway.app`)

### 4. Redeploy and verify

1. **Deployments** → Redeploy if needed
2. Open: `https://YOUR-API.up.railway.app/api/v1/health`
3. Docs: `https://YOUR-API.up.railway.app/api/docs`

If health fails, open **Deploy Logs** and check DB connection / build errors.

### 5. After first successful boot

1. Set `TYPEORM_SYNCHRONIZE=false`
2. Redeploy
3. Later set `CORS_ORIGINS` to your real admin/shop URLs

### 6. Always use production API / DB (local UIs)

Local admin, storefront, and POS are configured to call the Railway API  
(`https://mart-production-cdeb28ec.up.railway.app`), which uses the **production** Postgres.

On Railway API **Variables**, set CORS so local browsers work:

```text
CORS_ORIGINS=http://localhost:5173,http://localhost:5174,http://localhost:5175,https://mart-production-cdeb28ec.up.railway.app
```

(Or keep `CORS_ORIGINS=*` for early testing.)

You do **not** need local Docker Postgres for day-to-day app use.

### 7. Deploy Admin portal on Railway (same project)

Admin uses the shared `@mart/app` shell (same modules as POS; online-only).

1. In the Railway project → **+ New** → **GitHub Repo** (same `mart` repo) **or** Empty service + connect repo
2. Service settings:
   - **Root Directory**: `/` (repo root)
   - **Dockerfile path**: `web-apps/admin-portal/Dockerfile`
   - Or use `web-apps/admin-portal/railway.toml` if the service root is the repo
3. Build args / Variables:

| Variable | Value |
|----------|--------|
| `VITE_API_BASE_URL` | `https://mart-production-cdeb28ec.up.railway.app` |
| `VITE_TENANT_ID` | `00000000-0000-0000-0000-000000000001` |
| `VITE_FACILITY_ID` | `00000000-0000-0000-0000-000000000002` |

4. **Networking** → Generate Domain (e.g. `https://mart-admin-….up.railway.app`)
5. On the **API** service, set CORS to include the Admin domain (+ local POS ports):

```text
CORS_ORIGINS=https://YOUR-ADMIN.up.railway.app,http://localhost:5173,http://localhost:5174,http://localhost:5175
```

6. Verify: open Admin URL → Dashboard / Customers / Billing / Stock should load against Railway API.

### 7b. Frontends on Cloudflare Pages / Vercel (alternative)

Build with:

`VITE_API_BASE_URL=https://mart-production-cdeb28ec.up.railway.app`

---

## Path B — generic PaaS sketch

### 1. Create Postgres + Redis

Copy the provided `DATABASE_URL` / `REDIS_URL`.

### 2. Deploy API

- Root directory: `central-backend`
- Build: `npm ci && npm run build`
- Start: `node dist/server.js`
- Env:
  - `NODE_ENV=production`
  - `DATABASE_URL=...`
  - `REDIS_URL=...`
  - `JWT_SECRET=...`
  - `CORS_ORIGINS=https://admin...,https://shop...`
  - `TYPEORM_SYNCHRONIZE=true` (first boot only)

Health check path: `/api/v1/health`

### 3. Deploy Admin + Storefront (static)

Build with production API URL:

```bash
# admin
cd web-apps/admin-portal
VITE_API_BASE_URL=https://api.yourdomain.com npm run build
# upload dist/

# storefront
cd web-apps/client-storefront
VITE_API_BASE_URL=https://api.yourdomain.com npm run build
# upload dist/
```

### 4. Point POS (later)

Set desktop `POS_API_BASE_URL=https://api.yourdomain.com` (installer/wizard still to be built).

---

## Verify production

```bash
curl https://api.yourdomain.com/api/v1/health

curl -H "X-Tenant-Id: 00000000-0000-0000-0000-000000000001" \
  "https://api.yourdomain.com/api/v1/analytics/expiry/00000000-0000-0000-0000-000000000001"
```

---

## After cloud API works — Windows customers

1. Add `electron-builder` → produce `Mart-POS-Setup.exe`
2. Bake or wizard-configure `POS_API_BASE_URL=https://api.yourdomain.com`
3. Host the installer on your site / Drive / USB
4. Add auto-update (`electron-updater`)

That is a separate milestone from this cloud API deploy.

---

## Checklist

- [ ] Domain + DNS  
- [ ] VPS or PaaS accounts  
- [ ] `.env.production` secrets set  
- [ ] API health OK over HTTPS  
- [ ] Admin + Storefront load and call API  
- [ ] `TYPEORM_SYNCHRONIZE=false` after first boot  
- [ ] Backups for Postgres volume / managed DB  
- [ ] (Later) Windows POS installer  

---

## Files added for deploy

| File | Purpose |
|------|---------|
| `docker-compose.prod.yml` | Full prod stack |
| `.env.production.example` | Secrets/URLs template |
| `central-backend/Dockerfile` | API image |
| `web-apps/*/Dockerfile` | Static web images |
| `.github/workflows/ci.yml` | Build checks on push |
