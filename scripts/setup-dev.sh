#!/usr/bin/env bash
# ============================================================================
# SecureAuthX Pro — Development setup (Linux/macOS)
# ============================================================================
set -euo pipefail

echo "[1/5] Installing dependencies with pnpm..."
pnpm install

echo "[2/5] Generating Prisma client..."
pnpm db:generate

echo "[3/5] Starting infrastructure (PostgreSQL + Redis)..."
docker compose -f docker/docker-compose.yml --profile infra up -d

echo "[4/5] Applying database migrations..."
pnpm db:migrate

echo "[5/5] Seeding bootstrap administrator..."
pnpm db:seed

echo ""
echo "Setup complete."
echo "  API: http://localhost:4000/api/v1/health"
echo "  Web: http://localhost:3000"
echo "  Run: pnpm dev"
