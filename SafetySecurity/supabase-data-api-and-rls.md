# Supabase: Data API on + RLS on (safe construction)

**Audience:** AI agents and engineers building Freeplug.dev.

**Assumption:** Project keeps **Data API (PostgREST) enabled** and **Row Level Security enabled** on tables that hold customer or sensitive data.

## Principles

1. **RLS is the real boundary.** The Data API exposes HTTP access to tables; RLS decides what each role may read or write. **No policy = deny** (once RLS is enabled without a permissive default).
2. **Never ship the service role to the browser.** It bypasses RLS. Use it only in server-only code (API routes, server actions, webhooks, cron), via env vars not prefixed for client bundles.
3. **Anon and user JWT are for untrusted clients.** Anything reachable with the **anon** key or a logged-in user’s JWT must be **explicitly allowed** by RLS and minimal column exposure.

## Key placement

| Key / role | Where it may live |
|------------|-------------------|
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` + URL | Client OK only if all queries go to **RLS-protected** tables and policies are correct. Prefer server data fetching when in doubt. |
| **Service role** | **Server only** (API routes, webhooks, admin scripts). Never `NEXT_PUBLIC_*`. |

## RLS policy pattern (safe default)

- Enable RLS on every table with tenant or user data.
- **Default:** no broad `USING (true)` for `anon` or `authenticated` unless the row is truly public.
- **Typical customer row:** `USING (auth.uid() = user_id)` (or FK to `auth.users`) for `SELECT` / `UPDATE` as needed; `INSERT` with `WITH CHECK` tying new rows to `auth.uid()`.
- **Stripe/webhook/system rows:** written only from backend using **service role** (bypasses RLS) or a **locked-down** DB role used only on the server — do not map these tables to client Supabase calls unless policies are carefully scoped.

## Data API usage

- **Client `supabase.from('table')`:** only for tables with **correct RLS** for that caller. Prefer **narrow** policies over “authenticated can do everything.”
- **Server-only app path:** Next.js Route Handlers using **service role** or direct Postgres (`DATABASE_URL`) for Stripe reconciliation, milestone updates, admin uploads — keeps sensitive logic off the client.
- **Do not** rely on “obscure table names” or “we never call it from the UI” — assume the Data API is discoverable.

## Webhooks and background jobs

- Stripe (and similar) hit **your** HTTPS endpoints; those handlers use **service role** or DB connection with sufficient privileges, **verify signatures**, and perform **idempotent** updates. RLS on user tables still protects **direct** Supabase access; webhook code is trusted server code.

## Storage (if used)

- Enable RLS on **storage.objects** (or equivalent bucket policies). Buckets for transfer uploads: **no public read** unless intentional; prefer **signed URLs** and short TTLs for sensitive files.

## Checklist before shipping

- [ ] RLS enabled on all sensitive tables; policies reviewed for `SELECT` / `INSERT` / `UPDATE` / `DELETE`.
- [ ] Service role never in client bundle (search repo for accidental leak).
- [ ] No `anon` policy that exposes all rows of a tenant table.
- [ ] Webhook routes verify provider signatures; secrets only in server env.

## Related

- Service product rules: `ServiceGuideArchi/website-value-and-recurring-payments.md`, `ServiceGuideArchi/localhost-admin.md`.
