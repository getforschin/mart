#!/usr/bin/env bash
# Install desktop POS with native module rebuild (better-sqlite3 for Electron)
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
DESKTOP="$ROOT/desktop-app"

cd "$DESKTOP"

NODE_VERSION="$(node -v 2>/dev/null || echo 'unknown')"
NODE_MAJOR="$(node -p "process.versions.node.split('.')[0]" 2>/dev/null || echo 99)"

echo "▶ Installing desktop POS (Node $NODE_VERSION)..."

if [ "$NODE_MAJOR" -ge 23 ] 2>/dev/null; then
  echo ""
  echo "  ⚠ Node $NODE_VERSION is too new for prebuilt better-sqlite3 binaries."
  echo "    Switch to Node 20 LTS before continuing:"
  echo ""
  echo "      nvm install 20"
  echo "      nvm use 20"
  echo "      npm run pos:install"
  echo ""
  exit 1
fi

# Python 3.12+ removed distutils — node-gyp needs setuptools
if ! python3 -c "import distutils" 2>/dev/null && ! python3 -c "import setuptools" 2>/dev/null; then
  echo ""
  echo "  ⚠ Python setuptools/distutils not found (required to compile native modules)."
  echo "    Install build tools:"
  echo ""
  echo "      sudo apt update"
  echo "      sudo apt install -y build-essential python3-setuptools"
  echo ""
  exit 1
fi

# Skip native compile during npm install — rebuild for Electron ABI next
npm install --ignore-scripts

echo "▶ Rebuilding better-sqlite3 for Electron..."
npm run rebuild

echo "  ✓ Desktop POS native modules ready"
