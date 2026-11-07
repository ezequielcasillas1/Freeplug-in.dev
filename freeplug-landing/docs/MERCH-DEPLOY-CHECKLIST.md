# Merch deploy checklist (owner gate — not executed by preview PRs)

## Launch feature flags (Worker `vars` on production)

Set on the **production** Worker when promoting a version (not in git as live defaults):

| Var | Launch value | Preview / PR default |
|-----|----------------|----------------------|
| `MERCH_CHECKOUT_ENABLED` | `true` | unset / `false` |
| `MERCH_PERSONAL_DOWNLOAD_ENABLED` | `true` | unset / `false` |

Optional dev/demo:

- `MERCH_MOCK_CHECKOUT=true` — mock paid bundle flow (no Stripe); never in production.
- `MERCH_BUNDLE_LOCAL_PATH` / `MERCH_PERSONAL_DEMO_LOCAL_PATH` — local only.

## Stripe (reuse existing live setup)

- **No new API keys.** Use the Worker's existing secrets: `STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET`, `NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY` (already used for hosting).
- **No Dashboard Price ID.** Checkout uses inline `price_data` at **USD 49.99**.
- **Sales tax:** off (`automatic_tax.enabled: false`). Owner decision pending before enabling Stripe Tax.
- **Test locally:** `sk_test_` keys + `MERCH_CHECKOUT_ENABLED=true`.

### Webhook events (existing endpoint: `https://freeplug-in.dev/api/webhooks/stripe`)

Ensure these are enabled on the **live** Stripe webhook (same signing secret as today):

| Event | Merch use |
|-------|-----------|
| `checkout.session.completed` | Issue paid bundle download token + email |
| `charge.refunded` | Revoke download token |
| `charge.dispute.created` | Revoke download token |

(Other events remain required for hosting/buyout — do not remove.)

## R2 private storage (`MERCH_PRIVATE` binding)

Upload objects out-of-band (never in `public/`):

| Object key | Purpose |
|------------|---------|
| `freeplug-font-bundle-v1.zip` | Paid bundle (post-checkout token only) |
| `merch/freeplug-fonts-personal-demo.zip` | Limited personal-use demo (rate-limited public route) |

Uncomment and set in `wrangler.jsonc` for production:

```jsonc
"r2_buckets": [{ "binding": "MERCH_PRIVATE", "bucket_name": "freeplug-merch-private" }]
```

## Supabase (production project)

Apply migration:

- `supabase/migrations/20261107090000_merch_font_bundle.sql` → table `merch_font_bundle_tokens` (service_role only)

Rate limiting for personal demo uses existing `rate_check` RPC (no new migration).

## Worker secrets (unchanged names)

Already required for the site — confirm before go-live:

- `STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET`
- `SUPABASE_SERVICE_ROLE_KEY`
- `RESEND_API_KEY` (optional but recommended for download email)

## Smoke test after promote

1. `/merch`, all three tabs, `/es/merch/...`
2. Personal demo download with `MERCH_PERSONAL_DOWNLOAD_ENABLED=true`
3. Bundle checkout with Stripe **test** on preview, then live with owner sign-off
4. Webhook delivery + token download + refund revoke in staging
