#!/bin/sh
set -e

echo "[secchangelog] Ensuring upload directories..."
mkdir -p /app/public/uploads/screenshots
mkdir -p /app/public/uploads/logos
mkdir -p /app/public/uploads/favicons

echo "[secchangelog] Ensuring backup directory..."
mkdir -p "${BACKUP_DIR:-/app/data/backups}"

echo "[secchangelog] Applying pending database restore (if any)..."
cd /app
bun run scripts/restore-pending.ts

echo "[secchangelog] Applying database schema (prisma db push)..."
bun run db:push

echo "[secchangelog] Seeding database..."
bun run scripts/seed.ts

echo "[secchangelog] Starting Next.js standalone server on port ${PORT:-3000}..."
exec bun server.js