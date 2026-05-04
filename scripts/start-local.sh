#!/usr/bin/env bash
set -euo pipefail

cd "$(dirname "$0")/.."

if [ ! -f .env ] && [ ! -f .env.local ]; then
  echo "[start-local] no .env or .env.local found. Copy env.example.txt to .env.local first." >&2
  exit 1
fi

if [ ! -d node_modules ]; then
  echo "[start-local] installing dependencies"
  npm install
fi

echo "[start-local] syncing sqlite schema"
npm run db:push

echo "[start-local] starting next dev server"
exec npm run dev
