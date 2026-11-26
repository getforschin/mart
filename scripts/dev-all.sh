#!/usr/bin/env bash
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT"

# Prefer Node 20
if [ -s "$HOME/.nvm/nvm.sh" ]; then
  # shellcheck disable=SC1091
  . "$HOME/.nvm/nvm.sh"
  nvm use 20 >/dev/null
fi

echo "==> Node $(node -v)"

echo "==> Starting Docker infra (Postgres + Redis)..."
if docker info &>/dev/null; then
  docker compose up -d
elif sudo docker info &>/dev/null; then
  sudo docker compose up -d
else
  echo "ERROR: Cannot talk to Docker. Start Docker Desktop/daemon, then re-run."
  exit 1
fi

echo "==> Waiting for Postgres..."
for i in $(seq 1 30); do
  if docker compose exec -T postgres pg_isready -U mart_admin -d mart_omnichannel &>/dev/null \
    || sudo docker compose exec -T postgres pg_isready -U mart_admin -d mart_omnichannel &>/dev/null; then
    echo "Postgres is ready."
    break
  fi
  sleep 1
  if [ "$i" -eq 30 ]; then
    echo "WARNING: Postgres may still be starting; continuing anyway."
  fi
done

if [ ! -d central-backend/node_modules ]; then
  echo "==> Installing backend deps..."
  npm run backend:install
fi
if [ ! -f central-backend/dist/server.js ]; then
  echo "==> Building backend..."
  npm run backend:build
  npm run backend:seed || true
fi

# Ensure Electron binary is present (common after incomplete installs)
if [ ! -x desktop-app/node_modules/electron/dist/electron ]; then
  echo "==> Reinstalling Electron binary..."
  (cd desktop-app && rm -rf node_modules/electron && npm install electron@32.1.2 --save-dev)
  (cd desktop-app && npm run rebuild || true)
fi

mkdir -p "$ROOT/.dev-logs"

echo "==> Starting API on :3000"
npm run backend:start >"$ROOT/.dev-logs/backend.log" 2>&1 &
echo $! >"$ROOT/.dev-logs/backend.pid"

echo "==> Starting Admin portal on :5173"
npm run admin:dev >"$ROOT/.dev-logs/admin.log" 2>&1 &
echo $! >"$ROOT/.dev-logs/admin.pid"

echo "==> Starting Storefront on :5174"
npm run store:dev >"$ROOT/.dev-logs/store.log" 2>&1 &
echo $! >"$ROOT/.dev-logs/store.pid"

echo "==> Starting POS (Electron)..."
npm run pos:dev >"$ROOT/.dev-logs/pos.log" 2>&1 &
echo $! >"$ROOT/.dev-logs/pos.pid"

sleep 3
echo ""
echo "Stack starting. Open:"
echo "  API docs:   http://localhost:3000/api/docs"
echo "  Admin:      http://localhost:5173"
echo "  Storefront: http://localhost:5174"
echo "  POS:        Electron window (login: cashier / admin123)"
echo ""
echo "Logs: $ROOT/.dev-logs/"
echo "Stop later with: bash scripts/stop-all.sh"
