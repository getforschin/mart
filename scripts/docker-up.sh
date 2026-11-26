#!/usr/bin/env bash
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT"

if docker info &>/dev/null 2>&1; then
  docker compose up -d
elif sudo docker info &>/dev/null 2>&1; then
  sudo docker compose up -d
else
  echo "Cannot access Docker. Run manually:"
  echo "  sudo docker compose up -d"
  exit 1
fi

echo "Infrastructure started."
