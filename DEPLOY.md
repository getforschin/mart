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

## Path B — Step by step (PaaS sketch)

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
