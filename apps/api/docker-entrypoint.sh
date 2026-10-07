#!/bin/sh
set -e

# Sync the schema to the database on boot. For a scaffold this keeps the stack
# one-command runnable; a production deploy would run `prisma migrate deploy`
# against committed migrations instead of `db push`.
echo "[entrypoint] Applying database schema (prisma db push)…"
node_modules/.bin/prisma db push \
  --schema apps/api/prisma/schema.prisma \
  --skip-generate \
  --accept-data-loss

echo "[entrypoint] Starting API…"
exec node apps/api/dist/main.js
