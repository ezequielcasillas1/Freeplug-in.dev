#!/usr/bin/env bash
# Run a command with box-wide secrets unset so they can't leak into builds, caches, or logs
# (e.g. a prod build inlining ENVATO_API_TOKEN into .next/cache). Names only, never values.
# Usage: scripts/clean-env.sh npx next dev -p 3011
set -euo pipefail
exec env \
  -u ENVATO_API_TOKEN \
  -u SUPABASE_SERVICE_ROLE_KEY \
  -u SUPABASE_DB_PASSWORD \
  -u SUPABASE_ACCESS_TOKEN \
  -u STRIPE_SECRET_KEY \
  -u STRIPE_WEBHOOK_SECRET \
  -u RESEND_API_KEY \
  -u SMTP_PASS \
  -u CLOUDFLARE_API_TOKEN \
  -u PGDATABASE \
  -u __CURSOR_SANDBOX_ENV_RESTORE \
  "$@"
