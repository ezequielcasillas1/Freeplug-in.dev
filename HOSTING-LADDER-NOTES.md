# Hosting ladder: implementation notes (Owen, Oct 3 2026)

Spec: Aria's card (`/workspace/aria/freeplug-hosting-ladder-card.md`). Base: `bf5940f` (see `LADDER_BASE.txt`).
Review the whole change with `git diff bf5940f..`.

## One config module
`freeplug-landing/src/lib/plans/ladder.ts`: step ids, names, prices, Stripe product ids + lookup keys,
AI-edit quotas, perks (cumulative), legacy Basic/Plus/Pro entitlements (read only), queue order,
**`sellable`** per step, and the **business holidays** (`BUSINESS_HOLIDAYS`, `EXTRA_CLOSED_DATES`).
All customer wording: `freeplug-landing/src/lib/plans/ladder-copy.ts` (PLACEHOLDER, Sable/Wren).

## Stripe (test mode only so far)
- 6 Products `freeplug_step_<id>`, one monthly USD price each, lookup key `freeplug_step_<id>_monthly`,
  `metadata.plan_step`. Created by `node scripts/stripe-test-setup-ladder.mjs --env-file <file>`
  (idempotent; refuses anything but `sk_test_`/`rk_test_`; reads only the STRIPE_SECRET_KEY line of
  the file; `--dry-run`; `--probe` runs the proration / plan-move / portal probes;
  `--probe-conditions` runs Aria's 12:25 switching conditions with the app's change-plan.ts;
  `--tag-probes` archives the probe products and tags probe leftovers `metadata.probe=true`;
  `--probe-checkout-expiry` and `--probe-billing` run the round-3 checks on real test objects).
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

## Aria's conditions (Oct 3, 12:25)
- **Sellable:** `PLAN_STEPS[].sellable`. Leads, Get found, Growth partner = false ("Coming soon")
  until Ezequiel decides which perks he delivers by hand. Refused on the server (code `not_sellable`)
  by POST /api/checkout/hosting, claim step 3 (saveChosenPlan), claim step 4 setup Checkout, admin
  Publish and in-app plan switching. A subscriber already on a step keeps it (no forced move).
- **Plan moves:** an upgrade over a pending downgrade releases the schedule first (put back if the
  card fails); a declined upgrade voids the open proration invoice; cancel at period end clears a
  pending downgrade first (`cancelPlanAtPeriodEnd`); cancel then downgrade is refused (`ending`).
  The Plans page shows the pending downgrade and its date.
- **Perks only from the webhook:** `profiles.plan_step`, `plan_legacy`, `plan_legacy_addon`,
  `plan_monthly_cents` (+ `plan_step_synced_at`) are written only by the `customer.subscription.*`
  webhook sync (`plan-step-sync.ts`) and read through `plan-snapshot.ts` / `user-entitlements.ts`.
  Stripe is read directly only for a profile that was never synced.
- **Due dates:** next business day 5 PM America/Chicago, skipping weekends and the holidays in
  ladder.ts, with the federal observed-day rule (Sat -> Fri before, Sun -> Mon after; Aria 12:56).
- **Version check:** the 20260403120000 duplicate pair is pinned by version, filename and sha256.

## Aria's round 3 (Oct 3, 12:56)
- **AI-edit counts hidden:** `showAiEditQuota = false` in ladder.ts. The numbers stay in
  `aiEditsPerMonth`, read for customers only via `customerAiEditsPerMonth()` / `aiEditsLine()`.
  There is no enforcement. `ai-edit-quota-hidden.test.tsx` fails if any customer output shows a count.
- **Observed holidays:** `OBSERVE_WEEKEND_HOLIDAYS = true` applies the federal rule (Sat → Fri
  before, Sun → Mon after). New Year's Day on a Saturday closes Dec 31 of the year before.
- **Billing with a planned switch:** every Manage billing button goes to `/dashboard/plans?billing=pending`
  (the pending-change notice) whenever a live subscription has a schedule. Card updates use a portal
  session with `flow_data.type = payment_method_update` plus an after-completion redirect, with or
  without a schedule. Invoices are listed in the app (Plans > Billing, hosted invoice page and PDF
  links). We didn't use a portal flow because none is invoice-only.
- **Open checkouts:** every Checkout Session sets `expires_at` = now + 1 h, rounded down to the
  minute. Admin > Customers > "Expire open checkouts for steps not for sale"
  (`expireUnsellableCheckoutSessions`, idempotent) expires sessions for sellable=false steps. A
  late completion is honored and flagged in `plan_unsold_purchases`, which shows as an admin badge
  until marked reviewed.
- **Probe objects:** kept, no action.

## Round 4 (Oct 3, 1:39 PM): Lina's layout and the upgrade confirm
- **Layout** per `/workspace/freeplug-qa/design/hosting-ladder-ux-LINA-2026-10-03.md` (read-only; the
  do-not-restyle list is kept). `HostingCheckoutCard` has new props: `layout="columns"` (lg grid), `bare`/`hideHeading`
  (claim step 3 renders inside the page card), `stickyOnPhone`, `chooseLabelFor`, `currentMonthlyCents`,
  `renewalDate`. `MOST_POPULAR_STEP = null`. Coming soon sits under a divider (no radio, grey text, no opacity) and
  collapses on phones. The phone sticky bar is CSS `sticky bottom-0` inside the card, so it stays within the card.
- **Claim step 4 "Change"** (`clearClaimPlanAction` → `clearChosenPlan(userId)`): one conditional update that sets
  `plan_step` to null only while `setup_completed_at` is null and the site is not live; otherwise `locked`.
- **Upgrade confirm (Aria 1:34 PM):**
  - `previewPlanChange(step)` (billing-actions.ts): signed in, own Stripe customer only, exactly one live
    subscription, rate limit `plan_preview_user` (20 per 10 min). It calls `invoices.createPreview` with
    `proration_behavior: 'always_invoice'` and a server `proration_date` (now). It returns the amount due today,
    the next monthly amount and date, and the proration_date. The proration_date is also returned when the
    preview fails, so Confirm still pins it.
  - `changeHostingPlan(step, prorationDate)`: rejects a value that is not a safe integer. `changePlanStep` refuses a
    proration_date more than 600 s old or in the future before any Stripe write (`stale_preview` → grey line, back to
    Switch). The update gets `proration_date`, and its idempotency key is
    `plan-move:<user>:<step>:<proration_date>:<sub>:<prices>:<latest invoice>`; the last parts keep a retry after a
    failed card a new request. A concurrent second Confirm gets Stripe 409 `idempotency_key_in_use`, which maps to
    `in_progress` ("already going through") and does not put a pending downgrade back.
  - The UI closes the confirm 30 s before the 10-minute server limit (`CONFIRM_OPEN_MS`).
- **Probe** `--probe-upgrade-confirm` (log `/workspace/owen/ladder-conditions/probe-upgrade-confirm.log`), run on the
  probe customer at 1:57 PM CT. All 4 subscriptions were canceled and checked afterwards.
  - U1: the preview of $30.00 equals the invoice amount.
  - U2: with a pending downgrade, the preview of $10.00 equals the invoice amount, and the schedule is released.
  - U3: a stale or future proration_date is refused, and no invoice is created.
  - U4: double submit. Concurrent submits produce 1 upgrade and 1 `in_progress`; a later tap is `unchanged`; a
    replay is idempotent. Exactly 1 proration invoice.
- **Local dev stack:** the box shell exports a `STRIPE_WEBHOOK_SECRET` that overrode `.env.local` (process env wins
  in Next), so every local webhook got 400. Next dev now starts via `/workspace/owen/devstack/start-next.sh`, which
  unsets it.

## Database
`supabase/migrations/20261003180000_plan_steps.sql` (idempotent; 20261003170000 is reserved for account erase; explicit function revokes for the no-default-EXECUTE rule): `outreach_sites.plan_step`,
`profiles.plan_step` + `plan_step_synced_at` + the snapshot columns `plan_legacy`, `plan_legacy_addon`,
`plan_monthly_cents` (guard trigger), `website_requests.due_by` (guard
trigger), `included_edit_uses` (RLS forced; unique per user per billing period). Checked only on a
throwaway /tmp cluster (`/workspace/owen/ladder-sqlcheck/run.sh`). Not applied anywhere else.
Migration sha256 `2444b33ade092089bc0c59dfeecddf398310d42e8d013b84ffbc1654e9f0c8ab`.
`supabase/migrations/20261003190000_plan_unsold_purchases.sql` (round 3: one row per Checkout
Session completed for a step not for sale; service role only, RLS forced; idempotent), sha256
`ac103c883fa51614b1537c60a8b79f9d2bd0cb4842d3b85ab9a442fe6803f1f7`, checked with
`/workspace/owen/ladder-sqlcheck/run-unsold.sh`.

## Round 5 part 2 (Oct 3, about 3:10 PM CT): the tipping system and the change-plan lock
**Tips.** One $1/month Stripe price (`freeplug_tip_monthly`, product `freeplug_tip`) with quantity = tip
dollars, on the same subscription as the step price. Ranges are monthly totals per step in ladder.ts
(`TIP_TOTAL_RANGES`: Starter 35–54, Priority 55–64, Fast lane 65–74, Leads 75–84, Get found 85–99, Growth
100–120; only sellable steps take a tip). `src/lib/plans/tips.ts` validates (whole dollars, inside the
range, 0 = no tip item) and is used by checkout, claim save, publish and the tip change.
- Perks and priority come from the step's tier price only (`tierItems`); the tip is never part of the
  plan amount. The old "$55 total = Priority" helpers were removed; Starter + $19 stays Starter.
- Tip change on a live plan: `changeTip` (proration none, next bill), refused while a schedule exists,
  for legacy plans, and outside the range. Upgrade (`upgradeItems`) keeps only the new tier item, so
  the tip ends with the switch. A downgrade schedule's next phase has only the step price, so the tip
  ends at the phase change.
- Display: plan strip and claim summary "Fast lane · $65/month + $5 tip"; admin "$65/mo + $5 tip".
- Webhook: `billing_ledger.tip_cents` = the tip lines of the paid invoice (capped at amount_paid), with a
  fallback insert without the column before the migration. `cumulative_website_value_paid_cents` still
  counts the full amount (open question for Aria: should tips count toward buyout value?).
- Sable's confirm lines: zero-total line only at exactly $0.00; "This replaces your planned switch to X"
  only with a pending downgrade; the tip-ends lines only with a tip. Downgrades have no confirm, so the
  downgrade tip line sits under the downgrade button (Lina 3a: the "what happens" line under the
  button) and in the pending notice (it also explains why the tip box is locked).

**Change-plan lock (Aria).** `plan_change_locks` (one row per user, `claim_id`, 60 s expiry) with
`plan_change_lock_claim` (one INSERT … ON CONFLICT DO UPDATE WHERE expired) and
`plan_change_lock_release` (deletes only its own claim). Same claim-before-act pattern as email_sends, no
retry. `changeHostingPlan` claims before any Stripe call; a second call while it is held returns
`UPGRADE_IN_PROGRESS` and never calls Stripe; release in finally. A failed claim fails closed. Tip
preview/change use the same lock. The cancel action does not.

**Migrations for the r13 hosted set** (local DB only so far; both must be applied BEFORE this code deploys:
claim reads `outreach_sites.plan_tip_dollars`, and the lock fails closed without its table):
- `supabase/migrations/20261003200000_tipping.sql` sha256 `78b7786c09e2ae95c15c6a105d37fdddd8c0f38a8ee52a9910eedcb3f8d2b133`
- `supabase/migrations/20261003210000_plan_change_locks.sql` sha256 `5fff122bb1ab438a3285622dcc7f8a2fe4cc8fbdcbe535bd20a9de052a13779a`

**Probes (test mode):** `--probe-tips --lock-db <local pg url>`: T1 checkout with a tip, T2 plan step
ignores the tip, T3 tip change next cycle, T4 upgrade drops the tip (preview == invoice), T5 downgrade
drops it in the next phase, T6 the lock (two concurrent confirms over a pending downgrade: one upgrade,
one charge, schedule released). Logs `/workspace/owen/probe-tips-*.log`.

**Bot secrets (audit, steering C).** Local scripts never read SUPABASE_DB_PASSWORD,
SUPABASE_SERVICE_ROLE_KEY, CLOUDFLARE_API_TOKEN or STRIPE_WEBHOOK_SECRET from the environment: run
everything through `/workspace/owen/safe`; the setup script deletes them at start. The app itself reads
SUPABASE_SERVICE_ROLE_KEY / STRIPE_WEBHOOK_SECRET from process.env (they win over .env.local), so
`npm run dev|build|test` must also run through `safe`. `npm run upload:preview` and
`cf:upload:production` pass the whole environment to wrangler, which picks up CLOUDFLARE_API_TOKEN
implicitly (hosted; unchanged, waits for Vera's retest and Ezequiel's go).

## Not built (Part B)
L2 AI editor + quota enforcement, leads report job, form-fill storage, GBP API, SMS, L3.
