# Merch shop custom orders (hands-off preview)

Preview-only automation behind flags (defaults off).

## Flags / env

| Variable | Default | Purpose |
|----------|---------|---------|
| `MERCH_SHOP_ENABLED` | off | Shop routes |
| `MERCH_CHECKOUT_ENABLED` | off | Stripe checkout |
| `MERCH_CUSTOM_AUTOSEND_ENABLED` | off | 1h cancel window + Printify autosend |
| `MERCH_SHOP_CRON_SECRET` | unset | Authorize `POST /api/cron/merch-shop-custom` (or `CRON_SECRET`) |
| `MERCH_SHOP_UPLOAD_SIGNING_SECRET` | optional | HMAC for upload tokens (falls back to `SUPABASE_SERVICE_ROLE_KEY`) |
| `PRINTIFY_API_TOKEN` / `PRINTIFY_SHOP_ID` | unset | Printify fulfillment |
| `MERCH_SHOP_CUSTOM_DESIGN_FEE_CENTS` | **ignored** | Removed |

## Workers AI (moderation)

Wrangler binding:

```jsonc
"ai": { "binding": "AI" }
```

Model: `@cf/llava-hf/llava-1.5-7b-hf` with a safety prompt (nudity/sexual content, violence, hate symbols, obvious trademarks). Only a clear `SAFE` passes; `UNSAFE` blocks; anything else (UNCERTAIN, odd answers, model errors) is **held**.

Without the binding, uploads are treated as **held** (not pass).

## Cron / timers

| Timer | Mechanism |
|-------|-----------|
| 1 hour buyer cancel window | `cancel_until` on order; cron sends to Printify after |
| 48 hour held refund | `held_until`; cron refunds via Stripe if not approved |
| Daily cap (20, America/Chicago) | Count `paid_at` on custom orders; block checkout + UI |

Schedule **Cloudflare Cron Trigger** or external scheduler:

`POST https://<host>/api/cron/merch-shop-custom`  
Header: `Authorization: Bearer <MERCH_SHOP_CRON_SECRET>`

Recommended: every 5–15 minutes.

## Owner setup

1. Workers AI binding on production + preview Workers (already in `wrangler.jsonc`).
2. Apply `supabase/migrations/20261109120000_merch_shop_orders.sql` when launching.
3. Set cron secret and Cloudflare cron (or equivalent).
4. Approve borderline paid orders: `POST /api/admin/merch-shop/approve` with `{ "stripe_session_id": "cs_..." }` (admin auth).
5. Stripe: existing `checkout.session.completed` webhook is sufficient; refunds emit `charge.refunded` (no new event required).

## Admin approve

Owner-only (Supabase admin allowlist + `ADMIN_ROUTE_ENABLED`).
