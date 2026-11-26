#!/usr/bin/env bash
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT"

echo "========================================"
echo " Mart Omnichannel — First-Time Setup"
echo "========================================"
echo ""

# ── Docker helper (handles permission denied without sudo) ───────────────────
docker_cmd() {
  if docker info &>/dev/null 2>&1; then
    docker "$@"
    return $?
  fi
  if sudo docker info &>/dev/null 2>&1; then
    sudo docker "$@"
    return $?
  fi
  return 1
}

docker_compose() {
  docker_cmd compose "$@"
}

postgres_is_ready() {
  if docker_compose exec -T postgres pg_isready -U mart_admin -d mart_omnichannel &>/dev/null 2>&1; then
    return 0
  fi
  if command -v pg_isready &>/dev/null; then
    pg_isready -h localhost -p 5432 -U mart_admin -d mart_omnichannel &>/dev/null 2>&1
    return $?
  fi
  # Fallback: TCP port open
  if command -v nc &>/dev/null; then
    nc -z localhost 5432 &>/dev/null 2>&1
    return $?
  fi
  return 1
}

wait_for_postgres() {
  echo "  Waiting for PostgreSQL to become ready..."
  for i in $(seq 1 30); do
    if postgres_is_ready; then
      echo "  ✓ PostgreSQL ready"
      return 0
    fi
    sleep 2
  done
  echo "  ✗ PostgreSQL did not become ready in time"
  return 1
}

# ── 1. Infrastructure ──────────────────────────────────────────────────────
echo "▶ Starting Docker infrastructure (PostgreSQL + Redis)..."

if command -v docker &>/dev/null; then
  if docker_compose ps --status running 2>/dev/null | grep -q mart-postgres; then
    echo "  ✓ Containers already running (mart-postgres detected)"
    wait_for_postgres || exit 1
  elif docker_compose up -d 2>/dev/null; then
    wait_for_postgres || exit 1
  else
    echo "  ⚠ Could not start Docker via this script."
    echo "    If you already ran: sudo docker compose up -d"
    if postgres_is_ready; then
      echo "  ✓ PostgreSQL is reachable on localhost:5432 — continuing setup"
    else
      echo ""
      echo "  Fix Docker access (pick one):"
      echo "    1. Run containers first:  sudo docker compose up -d"
      echo "    2. Then re-run:             npm run setup"
      echo "    3. Or add your user to the docker group (permanent fix):"
      echo "         sudo usermod -aG docker \$USER"
      echo "         newgrp docker   # or log out and back in"
      echo ""
      exit 1
    fi
  fi
else
  echo "  ⚠ Docker not found — ensure PostgreSQL (5432) and Redis (6379) are running manually"
  if ! postgres_is_ready; then
    echo "  ✗ PostgreSQL is not reachable on localhost:5432"
    exit 1
  fi
  echo "  ✓ PostgreSQL is reachable — continuing"
fi

echo ""

# ── 2. Environment files ─────────────────────────────────────────────────────
echo "▶ Creating environment files..."

copy_env() {
  local src="$1" dest="$2"
  if [ ! -f "$dest" ]; then
    cp "$src" "$dest"
    echo "  ✓ Created $dest"
  else
    echo "  · $dest already exists — skipped"
  fi
}

copy_env central-backend/.env.example  central-backend/.env
copy_env web-apps/admin-portal/.env.example  web-apps/admin-portal/.env
copy_env web-apps/client-storefront/.env.example  web-apps/client-storefront/.env
copy_env desktop-app/.env.example  desktop-app/.env

# Fill in demo tenant/facility IDs for web apps
if ! grep -q "00000000-0000-0000-0000-000000000001" web-apps/admin-portal/.env 2>/dev/null; then
  cat > web-apps/admin-portal/.env <<'EOF'
VITE_API_BASE_URL=http://localhost:3000
VITE_TENANT_ID=00000000-0000-0000-0000-000000000001
VITE_AUTH_TOKEN=dev
EOF
  echo "  ✓ Configured web-apps/admin-portal/.env"
fi

if ! grep -q "00000000-0000-0000-0000-000000000001" web-apps/client-storefront/.env 2>/dev/null; then
  cat > web-apps/client-storefront/.env <<'EOF'
VITE_API_BASE_URL=http://localhost:3000
VITE_TENANT_ID=00000000-0000-0000-0000-000000000001
VITE_FACILITY_ID=00000000-0000-0000-0000-000000000002
VITE_TAX_RATE=18
EOF
  echo "  ✓ Configured web-apps/client-storefront/.env"
fi

echo ""

# ── 3. Backend ───────────────────────────────────────────────────────────────
echo "▶ Installing & building central-backend..."
npm install --prefix central-backend
npm run build --prefix central-backend

echo ""
echo "▶ Seeding demo data..."
npm run seed --prefix central-backend

echo ""

# ── 4. Web apps ──────────────────────────────────────────────────────────────
echo "▶ Installing web apps..."
npm install --prefix web-apps/admin-portal
npm install --prefix web-apps/client-storefront

echo ""

# ── 5. Desktop POS ───────────────────────────────────────────────────────────
echo "▶ Installing desktop POS app..."
if bash "$ROOT/scripts/pos-install.sh"; then
  echo "  ✓ Desktop POS ready"
else
  echo ""
  echo "  ⚠ Desktop POS install failed — web apps and API still work."
  echo "    Fix and retry later:"
  echo "      nvm install 20 && nvm use 20"
  echo "      sudo apt install -y build-essential python3-setuptools"
  echo "      npm run pos:install"
  echo ""
fi

echo ""
echo "========================================"
echo " Setup complete!"
echo "========================================"
echo ""
echo " Start services in separate terminals:"
echo ""
echo "   Terminal 1 — API:        npm run backend:start"
echo "   Terminal 2 — Admin UI:   npm run admin:dev"
echo "   Terminal 3 — Storefront: npm run store:dev"
echo "   Terminal 4 — POS:        npm run pos:dev"
echo ""
echo " URLs:"
echo "   API Swagger:  http://localhost:3000/api/docs"
echo "   Admin Portal: http://localhost:5173"
echo "   Storefront:   http://localhost:5174"
echo "   Adminer DB:   http://localhost:8080"
echo ""
