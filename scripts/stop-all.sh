#!/usr/bin/env bash
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
LOGDIR="$ROOT/.dev-logs"

stop_pidfile() {
  local name="$1"
  local file="$LOGDIR/$name.pid"
  if [ -f "$file" ]; then
    local pid
    pid="$(cat "$file")"
    if kill -0 "$pid" 2>/dev/null; then
      kill "$pid" 2>/dev/null || true
      # also kill child npm/node processes in the same group when possible
      pkill -P "$pid" 2>/dev/null || true
      echo "Stopped $name (pid $pid)"
    fi
    rm -f "$file"
  fi
}

stop_pidfile backend
stop_pidfile admin
stop_pidfile store
stop_pidfile pos

# Best-effort cleanup of known ports
for port in 3000 5173 5174 5175; do
  fuser -k "${port}/tcp" 2>/dev/null || true
done

echo "App processes stopped. Infra (Docker) left running — use: npm run infra:down"
