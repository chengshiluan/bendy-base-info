#!/usr/bin/env sh
set -e

DB_PATH="${DATABASE_URL:-/data/local.db}"
DB_DIR="$(dirname "$DB_PATH")"

if [ ! -d "$DB_DIR" ]; then
  mkdir -p "$DB_DIR"
fi

echo "[entrypoint] ensuring sqlite schema at ${DB_PATH}"
DATABASE_URL="$DB_PATH" node_modules/.bin/drizzle-kit push --config=drizzle.config.ts || {
  echo "[entrypoint] drizzle-kit push failed" >&2
  exit 1
}

exec "$@"
