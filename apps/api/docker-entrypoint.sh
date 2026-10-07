#!/bin/sh
set -e

# Apply committed migrations to the database on boot.
echo "[entrypoint] Applying database migrations (prisma migrate deploy)…"
node_modules/.bin/prisma migrate deploy --schema apps/api/prisma/schema.prisma

echo "[entrypoint] Starting API…"
exec node apps/api/dist/main.js
