#!/bin/sh
set -e

echo "[secchangelog] Ensuring upload directories..."
mkdir -p /app/public/uploads/screenshots
mkdir -p /app/public/uploads/logos

echo "[secchangelog] Applying database schema (prisma db push)..."
cd /app
bun run db:push

echo "[secchangelog] Seeding database..."
bun run scripts/seed.ts

echo "[secchangelog] Starting Next.js standalone server on port ${PORT:-3000}..."
exec bun server.js