#!/usr/bin/env bash
set -euo pipefail

# Refresh no-space copy from workspace, then start POS correctly.
ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
TARGET="${HOME}/mart-app"

echo "==> Syncing $ROOT -> $TARGET"
rm -rf "$TARGET"
cp -a "$ROOT" "$TARGET"

cd "$TARGET/desktop-app"

if [ -s "$HOME/.nvm/nvm.sh" ]; then
  # shellcheck disable=SC1091
  . "$HOME/.nvm/nvm.sh"
  nvm use 20 >/dev/null
fi

echo "==> Node $(node -v)"

# Vite must load types.ts, not a leftover CommonJS types.js beside it
rm -f src/shared/types.js src/shared/types.d.ts src/shared/types.js.map

echo "==> Compiling main/preload..."
npx tsc -p tsconfig.main.json
npx tsc -p tsconfig.preload.json
# Never leave compiled shared JS under src/ (breaks Vite ESM imports)
rm -f src/shared/types.js src/shared/types.d.ts src/shared/types.js.map

# Guarantee sandbox false in compiled output
if ! grep -q 'sandbox: false' dist/main/index.js; then
  echo "ERROR: dist still has sandbox true"
  exit 1
fi

pkill -f "desktop-app/node_modules/.bin/vite|electron/dist/electron" 2>/dev/null || true
fuser -k 5175/tcp 2>/dev/null || true
sleep 1

echo "==> Starting Vite on :5175"
npm run dev:renderer > /tmp/mart-pos-vite.log 2>&1 &
VITE_PID=$!

for i in $(seq 1 20); do
  if curl -sf http://127.0.0.1:5175/ >/dev/null; then
    echo "Vite ready."
    break
  fi
  sleep 0.5
  if [ "$i" -eq 20 ]; then
    echo "Vite failed to start. See /tmp/mart-pos-vite.log"
    exit 1
  fi
done

echo "==> Starting Electron (no-sandbox)"
echo "Login: cashier / admin123"
ELECTRON_DISABLE_SANDBOX=1 npx electron . --no-sandbox

kill "$VITE_PID" 2>/dev/null || true
