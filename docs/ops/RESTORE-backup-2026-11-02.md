# Freeplug backup — 2026-11-02

## Source
- Supabase project: **Freeplug.dev**, ref `ldlyjoybppmwvvcarewq`, region `us-west-2`, Postgres 17 (17.6.1.166)
- GitHub repo: `ezequielcasillas1/Freeplug-in.dev`; all 36 refs (branches, tags, PR heads) in `Freeplug-in.dev.bundle`
- Edge Functions: none. Storage buckets: 1 (`site_photos`); only the bucket definition is in this backup, not the files in it.

## Contents
- `schema/migrations_all.sql`: SQL from all 33 applied migrations, in order (taken from supabase_migrations.schema_migrations)
- `schema/rls_policies.sql` (27), `schema/functions.sql` (44), `schema/triggers_indexes_constraints.sql` (23 triggers + indexes + constraints, for reference), `schema/catalog.json` (raw catalog dump)
- `data/*.csv` + `data/data_inserts.sql`: rows from the non-empty public tables: profiles, website_requests, billing_ledger, rate_limit_hits, domain_requests, email_opt_outs. All other public tables had 0 rows.
- NOT included: auth.users (login accounts), storage objects (photos), secrets

## Env var names (values are NOT included; get them from Supabase/Stripe/Resend/Cloudflare dashboards)
NEXT_PUBLIC_SUPABASE_URL, NEXT_PUBLIC_SUPABASE_ANON_KEY, SUPABASE_SERVICE_ROLE_KEY, NEXT_PUBLIC_APP_URL,
STRIPE_SECRET_KEY, STRIPE_WEBHOOK_SECRET, STRIPE_PORTAL_CONFIGURATION_ID, STRIPE_LOCAL_MOCK_URL (dev only),
RESEND_API_KEY, RESEND_FROM_EMAIL, EMAIL_FROM, EMAIL_FROM_NAME, EMAIL_REPLY_TO,
NEXT_PUBLIC_TURNSTILE_SITE_KEY, TURNSTILE_SECRET_KEY, UNSUBSCRIBE_SECRET, UNSUBSCRIBE_DEV_FILE_STORE (dev),
ADMIN_EMAILS, ADMIN_ROUTE_ENABLED, ADMIN_ALLOW_ADJUST_CUMULATIVE_PAID,
CHANGE_APPROVAL_WEBHOOK_URL, CHANGE_APPROVAL_WEBHOOK_KEY, CLOUDFLARE_ENV,
NEXT_PUBLIC_FREEPLUG_I18N_ES, FREEPLUG_I18N_ES_ALLOW_PENDING, FREEPLUG_I18N_ES_PENDING_MARK, FREEPLUG_LOCKED_COPY
(For the template, see `freeplug-landing/.env.example` in the repo.)

## Restore steps
1. Repo: `git clone Freeplug-in.dev.bundle Freeplug-in.dev`, then `git remote set-url origin <new-remote>` and `git push --mirror`.
2. Create a Supabase project (region us-west-2 to match the original).
3. Schema: run `schema/migrations_all.sql` in the SQL editor or with psql. It recreates the tables, RLS, functions, triggers and the bucket. Use the other schema files to check the result.
4. Auth users: profiles.id references auth.users, so recreate or import the users before loading data. If you can't, run `SET session_replication_role = replica;` first.
5. Data: `psql "$DB_URL" -f data/data_inserts.sql` (or import the CSVs). Load profiles first.
6. Re-upload any site photos to the storage bucket.
7. Set the env vars above in the host (Cloudflare/Vercel), point the Stripe webhook at the new URL, and redeploy.
