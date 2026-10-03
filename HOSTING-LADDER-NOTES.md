# Hosting ladder: implementation notes (Owen, Oct 3 2026)

Spec: Aria's card (`/workspace/aria/freeplug-hosting-ladder-card.md`). Base: `bf5940f` (see `LADDER_BASE.txt`).
Review the whole change with `git diff bf5940f..`.

## One config module
`freeplug-landing/src/lib/plans/ladder.ts`: step ids, names, prices, Stripe product ids + lookup keys,
AI-edit quotas, perks (cumulative), legacy Basic/Plus/Pro entitlements (read only), queue order.
All customer wording: `freeplug-landing/src/lib/plans/ladder-copy.ts` (PLACEHOLDER, Sable/Wren).

## Stripe (test mode only so far)
- 6 Products `freeplug_step_<id>`, one monthly USD price each, lookup key `freeplug_step_<id>_monthly`,
  `metadata.plan_step`. Created by `node scripts/stripe-test-setup-ladder.mjs --env-file <file>`
  (idempotent; refuses anything but `sk_test_`/`rk_test_`; reads only the STRIPE_SECRET_KEY line of
  the file; `--dry-run`; `--probe` runs the proration / plan-move / portal probes).
- Checkout and outreach publish charge the lookup-key price only (fail closed with 503 if the
  price is missing or differs from ladder.ts).
- Plan moves happen in the app (Plans page, `changeHostingPlan` -> `src/lib/stripe/change-plan.ts`):
  upgrades immediate and prorated (`always_invoice`, `pending_if_incomplete`), downgrades at period end
  (subscription schedule). Reason: the Billing Portal can't hold two monthly prices of one product,
  and only schedules period-end downgrades between prices of the same product.
- Billing Portal: a non-default configuration (switching off; payment method, invoices, cancel at
  period end). Optional env **`STRIPE_PORTAL_CONFIGURATION_ID`** (bpc_..., not a secret) selects it;
  unset = Stripe's default configuration. Not added to `.env.example` / `.dev.vars.example` on
  purpose (no env files in ladder commits); add it there when the port's env docs are next edited.

## Database
`supabase/migrations/20261003180000_plan_steps.sql` (idempotent; 20261003170000 is reserved for account erase; explicit function revokes for the no-default-EXECUTE rule): `outreach_sites.plan_step`,
`profiles.plan_step` + `plan_step_synced_at` (guard trigger), `website_requests.due_by` (guard
trigger), `included_edit_uses` (RLS forced; unique per user per billing period). Checked only on a
throwaway /tmp cluster (`/workspace/owen/ladder-sqlcheck/run.sh`). Not applied anywhere else.

## Not built (Part B)
L2 AI editor + quota enforcement, leads report job, form-fill storage, GBP API, SMS, L3.
