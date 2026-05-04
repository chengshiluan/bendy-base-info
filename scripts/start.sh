#!/usr/bin/env bash
set -euo pipefail

cd "$(dirname "$0")/.."

IMAGE_TAG="${IMAGE_TAG:-bendywork-info-base:latest}"

if [ ! -f .env ]; then
  echo "[start] .env not found. Copy env.example.txt to .env and fill in secrets." >&2
  exit 1
fi

mkdir -p ./data

echo "[start] building image ${IMAGE_TAG}"
docker compose build

echo "[start] launching stack"
docker compose up -d

echo "[start] streaming logs (Ctrl+C to detach)"
docker compose logs -f app
