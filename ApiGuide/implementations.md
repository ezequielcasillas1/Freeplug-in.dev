### 2026-04-03 - Admin QA: override cumulative website value paid
**Status:** SUCCESS
**Files:** `freeplug-landing/src/app/admin/actions.ts`, `AdminCumulativePaidCell.tsx`, `AdminCustomersTable.tsx`, `admin/customers/page.tsx`, `.env.example`
**Result:** Env `ADMIN_ALLOW_ADJUST_CUMULATIVE_PAID=true` enables admin-only adjustment of `cumulative_website_value_paid_cents` for milestone / transfer handoff UI testing; no billing_ledger writes.

### 2026-04-02 - Stripe Checkout (hosting + maintenance)
**Status:** SUCCESS
**Files:** `freeplug-landing/src/app/api/checkout/hosting/route.ts`, `maintenance/route.ts`, `webhooks/stripe/route.ts`, `src/lib/stripe/*`, `HostingPlansSection.tsx`, `.env.example`
**Result:** API validates $20–$50/mo hosting + optional $5 add-on subscription; $50–$100 one-time maintenance; webhook stub logs key events. `npm run build` passes.

### 2026-04-02 - Stripe env + debug cleanup
**Status:** SUCCESS
**Files:** `src/lib/stripe/server.ts`, `hosting/route.ts`, `HostingPlansSection.tsx`
**Result:** `loadEnvConfig` for dev; clear errors for wrong key prefix (`mk_`); debug ingest logs removed; UI shows message if response has no checkout URL.

### 2026-04-02 - Supabase auth + dashboard
**Status:** SUCCESS
**Files:** `src/lib/supabase/*`, `proxy.ts` (was `middleware.ts`), `app/(auth)/*`, `app/(dashboard)/*`, `auth/callback/route.ts`, `Navigation.tsx`, `.env.example`
**Result:** Email/password login & signup (server actions), `/auth/callback`, protected `/dashboard`, session refresh via proxy; `@supabase/ssr` + anon key in env.

### 2026-04-02 - Next 16 proxy migration
**Status:** SUCCESS
**Files:** `src/proxy.ts` (removed `src/middleware.ts`)
**Result:** Next.js 16 deprecates `middleware.ts` for `proxy.ts` + `export function proxy`; fixes dev “Cannot find the middleware module” with Turbopack.
