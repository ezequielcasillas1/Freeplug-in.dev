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
- Billing Portal (Aria, Oct 3 4:05 PM): **card only**. Every portal session (Manage billing and Update
  card) is a `payment_method_update` flow that returns to `/dashboard/plans`, on a dedicated
  configuration with only `payment_method_update` on (`subscription_cancel`, `subscription_update`,
  `customer_update`, `invoice_history` off), made by `scripts/stripe-portal-config.mjs` (refuses a live
  key). Its id goes in **`STRIPE_PORTAL_CONFIGURATION_ID`** (bpc_..., not a secret; local `.env.local`
  only, never committed). **Without it the app refuses to open the portal** (Plans page "billing
  unavailable"); it never falls back to the account's default configuration. TEST id:
  `bpc_1UMaHXLOdeLTrjapNGnb5tDp`. Cancel and resume happen only in the app, under the change-plan lock.
  Before launch (checklist below): the business name in the portal header and the Stripe Link setting
  on the card form, both live-account settings.
- Accepted (Aria, Oct 3 4:40 PM): batch 68d7e2b, including the Stripe invoice PDF limits (tip row above
  the plan row; "(at $1.00 / month)" wording). Webhooks: `customer.subscription.updated` plus the lazy
  release on read are enough; no `subscription_schedule.updated` subscription.

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
  fallback insert without the column before the migration. `cumulative_website_value_paid_cents` counts
  the full amount, tips included (Aria, 3:31 PM CT, round 5b; see "Buyout: existing pieces").
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

## Round 5b (Oct 3, about 3:30 PM CT): Aria's items, Sable's final tip copy, Lina's slider
- **Nudge window** (Aria 1): `TIP_NUDGE_WINDOW_DOLLARS = 5` in ladder.ts (was "within $10"). The nudge
  shows from $5 below the next sellable step: Starter $50–54, Priority $60–64, Fast lane $70–74 (only
  once Leads is sold), Leads $80–84, Get found $95–99; none from Growth partner.
- **"Total Paid" counter** (Aria 2, reversed 3:31 PM CT): the webhook adds the full `amount_paid`, tips
  included. The short-lived `BUYOUT_COUNTS_TIPS` flag was dropped (no flag, nothing to flip).
- **Invoice list tip line** (Aria 3): `InvoiceRow.tipCents` (billing-routing.ts, tip lines of the
  invoice's first page of lines, capped at the total); BillingTools shows "Plan $55.00 · Optional tip $4.00"
  (`INVOICE_PLAN_PART` / `INVOICE_TIP_PART`, Sable FINAL 4:32 PM).
- **How the tip reads on Stripe** (test invoice 0TJQATSY-0001, review user 3, $59): line description
  "4 × Freeplug: optional monthly tip (at $1.00 / month)"; PDF row "Freeplug: optional monthly tip | Qty 4 |
  $1.00 | $4.00" (period Oct 3–Nov 3, 2026), listed ABOVE "Freeplug Hosting: Priority | 1 | $55.00".
  Script: `/workspace/owen/devstack/invoice-tip-line.mjs` (read-only, test key only).
- **Tip line renamed** (Aria 3:43 PM C): the Stripe TEST product `freeplug_tip` is now "Optional monthly
  tip" (`TIP_PRODUCT_NAME` in scripts/stripe-test-setup-ladder.mjs; renamed in place, same product and
  prices). New test invoice 3IAXC7R9-0001 ($59): API lines plan first, "1 × Freeplug Hosting: Priority (at
  $55.00 / month)" then "4 × Optional monthly tip (at $1.00 / month)". Stripe's PDF still renders the tip
  row ("Optional monthly tip | 4 | $1.00 | $4.00") above the plan row: the PDF does not follow the
  subscription item order, and we can't change that. Stripe's line format can't say "($1.00 each)"; it
  always prints "(at $1.00 / month)". Checkout, claim publish and the tip change already put the plan
  item first; a tip added later is appended, nothing is recreated (change-plan.test.ts). The live product
  name is set at launch by the same setup script.
- **Grandfathered plans** (Aria D): no tip slider and no tip preview/change (`no_tip_plan`) until the
  customer moves to a ladder step; then the tip box appears at $0 (tests in change-plan.test.ts and
  HostingCheckoutCard.test.tsx).
- **Claim tip box** (Aria E): claim step 3 uses the same slider before checkout and starts at $0; untouched
  it sends `tipDollars: 0` (HostingCheckoutCard.test.tsx, outreach/server.test.ts).
- **Tip ranges after launch** (Aria 4, follow-up, no code): before any range change after launch, publish
  should list the customers whose tip falls outside the new range and keep their tip until they change
  it, not refuse.
- **Sable's final tip copy** (3:20 PM CT, `/workspace/copy/freeplug-ladder-round5-tip-copy-2026-10-03.md`):
  all `TIP_*` strings swapped, `TIP_COPY_STATUS` = FINAL; `TIP_PRODUCT_NAME` unchanged. New
  `TIP_IN_PROGRESS` for a tip change while the change-plan lock is held (was `UPGRADE_IN_PROGRESS`).
  priority.ts: new `PRIORITY_HELP_ANSWER`; the unused `PRIORITY_DASHBOARD_LINE` ("front of our queue")
  removed. `HELP_PAYMENT_METHOD`, `CLOSE_BLOCKED_ACTIVE_PLAN_MESSAGE` and help b-5 pinned word for word to
  Sable's 3:15 PM re-locks (help-chat-content.test.ts).
- **Lina's slider** (3:19 PM): enabled slider has a hint (`TIP_SLIDER_HINT`), − / + buttons (44×44, $1,
  clamped, disabled at the ends, "Lower tip by $1" / "Raise tip by $1"), end labels in tip amounts
  ("No tip" / "$19 tip") in every state including the nudge; the range keeps aria-valuetext in dollars.
  Locked (switch planned): no bar, one read-only row (Lock icon + "$4 monthly tip", `TIP_LOCKED_AMOUNT`,
  Sable FINAL 4:32 PM) and `TIP_LOCKED_NOTE(date)`; with no tip, "No tip" + `TIP_CHANGE_PENDING`. Same
  component in Plans, the checkout card and claim step 3 (step 4 is a summary, no slider).
- **Downgrade button short date** (Lina): "Switch to Starter on Nov 3" (`formatShortPlanDate`, year only
  when not the current year); hint lines keep the full date. One line at 375.
- **Request page** (Lina): the Manage billing button under the close-blocked message is now a "Cancel
  options" text link to `/dashboard/cancel` (`CANCEL_OPTIONS_LINK`).
- **Envato tile** (Sable 3:10 PM): "Premium templates our developers can access, enhanced with your
  details." Wraps to 3 lines at 1280 and 1440; hidden at 375 (descriptions are desktop only).

## Launch checklist (Stripe live; each needs Ezequiel's yes)
- **Live card-only portal configuration:** run `scripts/stripe-portal-config.mjs` against the LIVE
  account only at launch, with Ezequiel's yes (the script refuses live keys today; the launch run needs
  a reviewed live variant). Put the live bpc_ id in the hosted `STRIPE_PORTAL_CONFIGURATION_ID`. Until it
  is set, Manage billing / Update card show "billing unavailable" (by design).
- **Portal / business name in the portal header:** the Stripe customer portal header shows the account's
  public business name, which in test mode reads "ezequiel casillas" (screenshots
  `/workspace/owen/portal-card-only-*.png`). Set it in the live account's public business details before
  launch (it's the account's name, not part of the portal configuration; the configuration's headline
  "Freeplug: update your card" is separate).
- **Stripe Link on the card form:** the portal's card form offers Link ("Save my information for faster
  checkout", email + phone). That's an account setting (Payment methods), not the portal configuration
  or app code. Decide on or off for the live account before launch.
- **Webhook events: no change needed** (Aria, Oct 3 4:40 PM). `subscription_schedule.updated` is NOT
  added to the endpoint: Stripe doesn't send it at the switch anyway (test clock E6), and
  `customer.subscription.updated` (plus `invoice.paid`) and the lazy release on read are enough. The
  handler for it stays in route.ts, harmless if it ever arrives.
- Migrations 20261003200000 / 20261003210000 (and r13's 20261003220000) before the deploy.
- **Add-ons launch guard (Jace, Oct 4):** the add-ons code must NEVER be deployed to a hosted project
  until `20261004090000_plan_addons`, `20261004091000_addon_edit_uses` and
  `20261004092000_addon_removals_owed` are already applied there (check `supabase_migrations.schema_migrations` on that
  project first). Without `addon_removals_owed`, every owed-removal save fails, so a single Stripe error
  on an upgrade or resume leaves a turned-off add-on renewing (Vera de173c8 L-1 / I-6).

## Buyout: existing pieces (for Aria's pay-to-own card)
Nothing here changes until Aria's card is approved. Ezequiel wants a pay-to-own option; today there is
only a quoted buyout.
- **Buyout request flag:** `website_requests.is_buyout` (boolean, default false):
  `supabase/migrations/20260925204500_website_requests_is_buyout.sql:25`; a price requires it
  (`website_requests_buyout_price_requires_is_buyout`, same file :77-79). Set by
  `requestBuyoutQuote` (`src/app/(dashboard)/dashboard/buyout-actions.ts:14`) via `recordBuyoutRequest`
  (`src/lib/buyout/buyout.ts:138`).
- **Buyout price (owner-set):** `website_requests.buyout_price_cents`:
  `supabase/migrations/20260925204000_website_requests_buyout_price_cents.sql:23` (guard trigger :35-70,
  service role only). Admin field: `AdminBuyoutPriceCell` (`src/app/admin/AdminBuyoutCell.tsx:31`),
  rendered in `src/app/admin/AdminRequestRow.tsx:102`, saved by `adminSetBuyoutPrice`
  (`src/app/admin/actions.ts:177`); badge `AdminBuyoutBadge` (`AdminBuyoutCell.tsx:15`).
- **Paid-total counter:** `profiles.cumulative_website_value_paid_cents`
  (`supabase/migrations/20260402120000_profiles_and_website_requests.sql:6`). Written by the webhook
  (`src/app/api/webhooks/stripe/route.ts:192-198`, full amount paid, tips included; there is no
  `BUYOUT_COUNTS_TIPS` flag any more) and by the admin override `adminSetProfileCumulativeWebsiteValuePaid`
  (`src/app/admin/actions.ts:136`, cell `src/app/admin/AdminCumulativePaidCell.tsx:12`). Read by the admin
  "Paid (cumulative)" column (`src/app/admin/AdminCustomersTable.tsx:133,155-160`), the dashboard "Total
  Paid" (`src/app/(dashboard)/dashboard/QuickStats.tsx:33-35` via `dashboard-actions.ts:345`), the cancel
  page data (`src/app/(dashboard)/dashboard/cancel/actions.ts:69,86,96`), and the old handoff RPC
  `acknowledge_website_transfer()` (`supabase/migrations/20260404100000_close_website_request_rpcs.sql:46`:
  counter >= `website_value_target_cents`; granted to authenticated, no app caller today).
- **Pay-to-own must not use this counter.** It will get its own `ownership_credits` ledger built from
  invoice lines (tier lines only, per Aria's rules), summed, not this running total.
- **Known drift (note only, no fix now):** the invoice.paid profile total (`route.ts` about 184-204) is
  read-modify-write: it inserts the `billing_ledger` row, then writes `prev + amount_paid`. If that
  update fails, Stripe's redelivery hits the ledger's unique index (23505) and stops, so the increment is
  lost for good; two invoices paid at the same moment can also overwrite each other. Pay-to-own progress
  must be SUM-based (e.g. SUM over the ledger), never this counter.
- **Buyout cards (dashboard, not landing):** `BuyoutCard` (`src/app/(dashboard)/dashboard/BuyoutCard.tsx`),
  on the dashboard home as `DashboardBuyoutCard` (`src/app/(dashboard)/dashboard/page.tsx:199-203`,
  `alreadyRequested` from `is_buyout`) and the cancel page (`src/app/(dashboard)/dashboard/cancel/CancelPlanView.tsx:227,300`);
  button `BuyoutRequestButton.tsx:49`. The landing page has no buyout card.
- **Buyout copy:** `src/lib/buyout/buyout.ts:21-37` (`BUYOUT_DASHBOARD_HEADING` / `_BODY`,
  `BUYOUT_REQUEST_LABEL`, `BUYOUT_THANKS`, `BUYOUT_CANCEL_HEADING` / `_BODY`, `BUYOUT_FAQ_QUESTION` /
  `_ANSWER`, admin badge/labels); FAQ `src/app/faq/page.tsx:44-46`; help chat 'buy-website'
  (`src/lib/help/help-chat-content.ts`, `BUYOUT_FAQ_ANSWER`); cancel help answer
  (`src/app/(dashboard)/dashboard/help/page.tsx:102`).

## Sable's final wording, 4:32 PM CT (billing fix batch 68d7e2b)
Source: `/workspace/copy/freeplug-ladder-round5-tip-copy-2026-10-03.md`, "Added 4:32 PM CT". All in ladder-copy.ts,
pinned word for word in ladder-copy.test.ts:
- `RESUME_FAILED_MESSAGE`: "We couldn't resume your plan, so it's still set to end. Please try again in a moment, or
  contact us at support@freeplug-in.dev or 737-392-5612 and we'll help." (email/phone from src/lib/site.ts)
- `CANCEL_FAILED_MESSAGE`: "We couldn't cancel your plan just now, so nothing has changed. Please try again in a
  moment, or contact us at support@freeplug-in.dev or 737-392-5612."
- `INVOICE_PLAN_PART` / `INVOICE_TIP_PART`: "Plan $55.00 · Optional tip $4.00".
- `TIP_LOCKED_AMOUNT`: "$4 monthly tip". `TIP_LOCKED_NOTE` is not in the 4:32 list, so it keeps the 3:19 wording.
- `CHANGE_PLAN_ENDING` (plan switch): "Your plan is set to end. Choose Resume plan first, then switch."
- `TIP_CHANGE_ENDING` (new, tip box only; the tip refusal used to reuse the plan-switch line): "Your plan is set to
  end, so your tip can't be changed. Choose Resume plan first."
- The dashboard tab stays "Cancel"; the locked file now says "Cancel" too (DashboardChrome.test.tsx checks both).

## Vera B1-B3 on 68d7e2b + Sable 5:11 PM (Oct 3)
- **B1 (MEDIUM) double Resume:** the Resume plan buttons (dashboard alert, cancel page) use
  `ResumePlanSubmit` (useFormStatus: disabled + aria-busy while the form submits). On the server,
  when `resumePlan` didn't resume anything itself (lock held, nothing left to resume, or the update
  threw) it re-reads the live subscriptions from Stripe (`resumeOutcomeFromLive`): running and none set
  to end -> `/dashboard?hosting=resumed`; still ending while the lock was held -> `?hosting=resume_busy`;
  otherwise `?hosting=resume_failed`. Never the portal.
- **B2:** `RESUME_BUSY_MESSAGE` "Your plan is already being updated. Please try again in a moment."
  (Sable FINAL 5:11 PM), shown only for lock held + still ending.
- **B3:** the "Subscription ending" alert names the plan only ("Fast lane will end in 31 days. Resume
  to keep your website live.") and its "Resume plan" goes to `/dashboard/cancel#resume-plan` (the cancel
  page's Resume box; the Plans page has no Resume). The Active Subscriptions list reads "Fast lane + $4
  tip" (`subscriptionListName`, PLAN_STRIP_TIP pattern); grandfathered plans keep their product names.
- **Sable 5:23 PM:** the ending alert reads "Your Fast lane plan will end in 31 days. Resume to keep
  your website live." (a grandfathered plan: "Your <product names> will end…", no extra "plan"); the link
  stays `/dashboard/cancel#resume-plan`. Recent activity ("Subscription started") uses the list name
  ("Fast lane + $4 tip" / "Fast lane"). The cancel page plan cards read the plan name only ("Fast lane";
  grandfathered plans keep their product name).

## Not built (Part B)
L2 AI editor + quota enforcement, leads report job, form-fill storage, GBP API, SMS, L3.
