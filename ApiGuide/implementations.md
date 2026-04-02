### 2026-04-02 - Stripe Checkout (hosting + maintenance)
**Status:** SUCCESS
**Files:** `freeplug-landing/src/app/api/checkout/hosting/route.ts`, `maintenance/route.ts`, `webhooks/stripe/route.ts`, `src/lib/stripe/*`, `HostingPlansSection.tsx`, `.env.example`
**Result:** API validates $20–$50/mo hosting + optional $5 add-on subscription; $50–$100 one-time maintenance; webhook stub logs key events. `npm run build` passes.

### 2026-04-02 - Stripe env + debug cleanup
**Status:** SUCCESS
**Files:** `src/lib/stripe/server.ts`, `hosting/route.ts`, `HostingPlansSection.tsx`
**Result:** `loadEnvConfig` for dev; clear errors for wrong key prefix (`mk_`); debug ingest logs removed; UI shows message if response has no checkout URL.
