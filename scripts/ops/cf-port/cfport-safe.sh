#!/usr/bin/env bash
unset SUPABASE_DB_PASSWORD SUPABASE_SERVICE_ROLE_KEY CLOUDFLARE_API_TOKEN STRIPE_WEBHOOK_SECRET  # bot secrets: never inherited (Oct 3 audit)
# Run a command with live keys/DB vars cleared and Node 22 first on PATH (CF port, 2026-10-03).
# __CURSOR_SANDBOX_ENV_RESTORE: sandbox env snapshot that still carries the live service-role JWT (found by the upload guard, Oct 3).
exec env -u PGDATABASE -u PGHOST -u PGUSER -u PGPASSWORD -u DATABASE_URL \
  -u STRIPE_SECRET_KEY -u STRIPE_WEBHOOK_SECRET -u NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY \
  -u SUPABASE_SERVICE_ROLE_KEY -u SUPABASE_DB_PASSWORD -u SUPABASE_ACCESS_TOKEN \
  -u RESEND_API_KEY -u SMTP_PASS -u CLOUDFLARE_API_TOKEN -u CLOUDFLARE_ACCOUNT_ID -u CF_API_TOKEN \
  -u __CURSOR_SANDBOX_ENV_RESTORE \
  WRANGLER_SEND_METRICS=false NEXT_TELEMETRY_DISABLED=1 \
  PATH="/workspace/aria/scratch/node22/bin:$PATH" "$@"
