#!/bin/sh
# Generate strong production secrets for MoonBite Partners.
# Prints KEY=VALUE lines — paste into your secret store (GitHub Actions secrets,
# your server's .env, or a vault). Do NOT commit the output.
#
# Usage:  sh scripts/generate-secrets.sh
set -e

gen() { openssl rand -hex 32; }

cat <<EOF
# --- MoonBite Partners generated secrets ($(date -u +%Y-%m-%dT%H:%M:%SZ)) ---
JWT_SECRET=$(gen)
DOWNLOAD_URL_SECRET=$(gen)
POSTGRES_PASSWORD=$(gen)
# Set the rest yourself (not random): WEB_BASE_URL, PUBLIC_BASE_URL, CORS_ORIGINS,
# SMTP_HOST/USER/PASS/MAIL_FROM, STORAGE_BASE_URL, and the MBITE_* chain params.
EOF
