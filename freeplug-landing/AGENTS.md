<!-- BEGIN:nextjs-agent-rules -->
# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` before writing any code. Heed deprecation notices.
<!-- END:nextjs-agent-rules -->

## Production go-live

- Set `NEXT_PUBLIC_APP_URL` to the production origin (no trailing slash). Use the same value in Stripe and Supabase allowlists.
- **Stripe (live):** `STRIPE_SECRET_KEY`, `NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY`, `STRIPE_WEBHOOK_SECRET`. Webhook URL: `https://<your-domain>/api/webhooks/stripe` (events: `checkout.session.completed`, `invoice.paid`, subscription events as configured).
- **Supabase:** `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, server-only `SUPABASE_SERVICE_ROLE_KEY`. In Dashboard → Authentication → URL configuration: Site URL and redirect URLs for `/auth/callback`, `/dashboard`, `/login`, etc.
- Apply SQL migrations in `supabase/migrations/` to the production project (including `billing_ledger` select policy for dashboard invoice counts).
- Smoke test on a staging URL first: sign-in, dashboard, hosting checkout (test mode), webhook delivery to Supabase.
