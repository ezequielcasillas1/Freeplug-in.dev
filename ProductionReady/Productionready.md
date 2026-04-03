# Production-ready — Supabase & website value

## Schema & migrations

- Apply all SQL in `freeplug-landing/supabase/migrations/` to **production** Supabase (especially `profiles`, `website_requests`, `billing_ledger`, RLS, triggers).
- Confirm `profiles` has: `website_value_target_cents`, `cumulative_website_value_paid_cents`, `evaluation_status`, `evaluation_progress`, `stripe_customer_id`.

## Website value target (agreement)

- **`website_value_target_cents`** is not set by the app when a user submits a request. After commercial agreement, set it explicitly (USD × 100), e.g. `$1,000` → `100000`.
- **Who sets it:** trusted path only — Supabase SQL/Table Editor, a future admin action, or an internal script. Customers cannot self-set via RLS today.
- **Align with status:** when terms are finalized, move `evaluation_status` to `agreed` and set `evaluation_progress` as you like (e.g. toward 100). Target and status should match your ops process.

## Cumulative paid (Stripe → DB)

- **`invoice.paid`** webhook (`/api/webhooks/stripe`) inserts into **`billing_ledger`** (idempotent on `stripe_invoice_id`) and increments **`profiles.cumulative_website_value_paid_cents`** by **`inv.amount_paid`** for the profile matched by **`stripe_customer_id`**.
- **Production:** deploy the app with `STRIPE_WEBHOOK_SECRET`, `SUPABASE_SERVICE_ROLE_KEY`, Stripe live keys; register the **live** webhook URL in Stripe Dashboard; ensure `checkout.session.completed` has run so profiles have `stripe_customer_id`.
- **Product rule gap:** today **every** paid invoice amount for that customer adds to cumulative. If only *some* charges should count toward “website value,” extend the webhook to filter by invoice line items / metadata before updating `cumulative_website_value_paid_cents` and ledger rows.

## Dashboard behavior

- Progress “$ paid / $ target” shows only when **`website_value_target_cents`** is non-null and &gt; 0.
- “Website value reached” when **`cumulative_website_value_paid_cents` ≥ `website_value_target_cents`** (and target &gt; 0).

## Ops checklist (short)

- [ ] Production Supabase migrated and RLS reviewed.
- [ ] On each signed deal: set `website_value_target_cents`, set `evaluation_status` / `evaluation_progress` as needed.
- [ ] Stripe live webhook → production URL; test one paid invoice → row in `billing_ledger` and profile cumulative updated.
- [ ] Decide and implement which invoice amounts count toward website value (optional code change to webhook).
