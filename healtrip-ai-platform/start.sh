#!/usr/bin/env bash
# HealTrip: start everything with one command.
#
#   ./start.sh
#
# Starts the API on :4000 and the site on :3000, waits until the API answers,
# then prints the URLs. Ctrl+C stops both. No Docker, no API key needed.

set -u
cd "$(dirname "$0")"

API_PORT="${API_PORT:-4000}"

say() { printf '%s\n' "$*"; }
die() { printf '\n%s\n' "$*" >&2; exit 1; }

command -v node >/dev/null 2>&1 || die "Node.js is not installed. Install Node 20 or newer, then run this again."
NODE_MAJOR="$(node -p 'process.versions.node.split(".")[0]')"
[ "$NODE_MAJOR" -ge 18 ] || die "Node $NODE_MAJOR is too old. Install Node 20 or newer."

port_busy() { (exec 3<>"/dev/tcp/127.0.0.1/$1") >/dev/null 2>&1; }

if port_busy "$API_PORT"; then
  say "Port $API_PORT is already in use. Stopping whatever is on it."
  pkill -f "node src/server.js" 2>/dev/null || true
  sleep 1
  port_busy "$API_PORT" && die "Port $API_PORT is still busy. Free it, or run: API_PORT=4100 ./start.sh"
fi
if [ ! -d backend/node_modules ]; then
  say "Installing backend dependencies, this happens once."
  ( cd backend && npm install --no-audit --no-fund >/dev/null ) || die "npm install failed. Check your internet connection."
fi

[ -f .env ] && set -a && . ./.env && set +a

say "Starting the API on :$API_PORT"
( cd backend && PORT="$API_PORT" node src/server.js ) &
API_PID=$!

for i in $(seq 1 30); do
  if curl -fsS "http://localhost:$API_PORT/api/v1/health" >/dev/null 2>&1; then break; fi
  sleep 0.5
  if ! kill -0 "$API_PID" 2>/dev/null; then die "The API stopped while starting. Scroll up for the reason."; fi
  [ "$i" = 30 ] && die "The API did not answer on :$API_PORT within 15 seconds."
done

STORAGE="$(curl -fsS "http://localhost:$API_PORT/api/v1/health" | node -p 'JSON.parse(require("fs").readFileSync(0,"utf8")).storage' 2>/dev/null || echo unknown)"

say ""
say "────────────────────────────────────────────────"
say "  HealTrip is running"
say ""
say "  Site      http://localhost:$API_PORT"
say "  API       http://localhost:$API_PORT/api/v1/health"
say "            the site and the API share one port, so nothing to configure"
say "  Storage   $STORAGE"
say ""
say "  Demo      node scripts/demo.js"
say "  Stop      Ctrl+C"
say "────────────────────────────────────────────────"
say ""

cleanup() { kill "$API_PID" 2>/dev/null; exit 0; }
trap cleanup INT TERM
wait "$API_PID"
