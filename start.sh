#!/usr/bin/env bash
# Start LifeOS: installs dependencies and builds when needed, then serves the app
# on http://localhost:4300 with the database at ./data/lifeos.sqlite.
#
#   ./start.sh            build if needed, start, open the browser
#   ./start.sh --dev      hot-reloading dev server instead (for working on the code)
#   PORT=5000 ./start.sh  use another port
#   NO_OPEN=1 ./start.sh  don't open the browser
set -euo pipefail

cd "$(dirname "$(readlink -f "$0")")"
PORT="${PORT:-4300}"
URL="http://localhost:${PORT}"

if ! command -v node >/dev/null 2>&1; then
  echo "Node.js is required (https://nodejs.org)." >&2
  exit 1
fi

if [ ! -d node_modules ] || [ package.json -nt node_modules ]; then
  echo "Installing dependencies…"
  npm install --no-audit --no-fund
  touch node_modules
fi

open_browser() {
  [ -n "${NO_OPEN:-}" ] && return
  # wait until the server answers, then open it once
  for _ in $(seq 1 60); do
    if curl -fs -o /dev/null "$URL" 2>/dev/null; then
      command -v xdg-open >/dev/null 2>&1 && xdg-open "$URL" >/dev/null 2>&1 || true
      return
    fi
    sleep 0.5
  done
}

if curl -fs -o /dev/null "$URL" 2>/dev/null; then
  echo "LifeOS is already running at $URL"
  command -v xdg-open >/dev/null 2>&1 && xdg-open "$URL" >/dev/null 2>&1 || true
  exit 0
fi

if [ "${1:-}" = "--dev" ]; then
  open_browser &
  exec npx vite --port "$PORT"
fi

# Rebuild when anything that ends up in the bundle is newer than the last build.
if [ ! -f dist/index.html ] || [ -n "$(find src public index.html vite.config.ts package.json -newer dist/index.html -print -quit)" ]; then
  echo "Building…"
  npm run build
fi

open_browser &
PORT="$PORT" exec node server.mjs
