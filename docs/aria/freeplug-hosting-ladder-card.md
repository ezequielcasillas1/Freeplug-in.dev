# Freeplug hosting ladder: decision card (Aria, DRAFT v1, Sat Oct 3 2026, ~11:40 AM CT)
Research and drafting only. No Stripe or Supabase reads or writes, no commits, no deploys, nobody contacted.
- Code read: `/workspace/freeplug-cf-port/freeplug-landing` (branch `cf-port-2026-10-03`, uncommitted work). Every pricing file below is **identical** on `backup/box-build-2026-10-03` (`/workspace/freeplug-in-dev`). The port's differences are email, image, IP and webhook-signature work, plus one extra migration (`20261003160000_email_sends.sql`). None of it touches pricing, so the line refs work on both branches.
- Direction (Ezequiel, relayed): cumulative **$55 / $65 / $75 / $85 / $100** ladder. Speed matters. This card reconciles it with Part B of `freeplug-cloudflare-and-owner-editing-card.md` (L1–L3 editing, bands, AI quotas 5/15/40).
- Anything marked **(est.)** is my estimate, not a measurement. Anything marked **(unsure)** needs checking.

---
## 1. Current model (from code)
| Topic | What the code does | Ref |
|---|---|---|
| Hosting amount | Free slider, whole dollars, **$35–$100** (default $35), validated on the server | `src/lib/stripe/config.ts:2-4,53-58`; `src/app/api/checkout/hosting/route.ts:54-60` |
| Add-ons | One optional tier on top, cumulative: **Basic $5** ("Regular backups", "Downtime alerts"), **Plus $10** (+ "One small edit per month (no rollover)"), **Pro $15** (+ "Google Business Profile kept current: hours, photos, one post a month") | `config.ts:8-40` |
| Monthly total | hosting + add-on (`totalCents`), summed over active/trialing subs; yearly ÷ 12 | `src/lib/outreach/plan.ts:9-18`; `src/lib/plans/priority.ts:21-38` |
| Priority | `total >= 5500` ⇒ Priority. Only effects: a dashboard line ("Priority included: your change requests go to the front of our queue."), a help-chat answer, and an admin **badge on the Customers table** | `priority.ts:5-15,27-29`; `SubscriptionDetails.tsx:128-129`; `AdminCustomersTable.tsx:4,160-165`; `admin/customers/page.tsx:65,90` |
| **Queue jump isn't enforced** | `admin/requests/page.tsx:27` sorts requests by `created_at desc` only and shows no Priority badge. "Front of the queue" is a promise a person has to remember. | — |
| **Plus/Pro "small edit" isn't tracked** | `hasMonthlyEditAddon()` matches the Stripe **product name prefix** "Plus add-on"/"Pro add-on" and only shows a note in the help chat. Nothing counts usage. | `src/lib/stripe/active-subscription.ts:138-161`; `dashboard/help/layout.tsx:16-30`; `HelpChat.tsx:22-23,240` |
| **Basic's backups and downtime alerts** | Nothing in Freeplug's code delivers them (no backup or uptime job found) **(unsure whether they're done by hand)** | grep of `src` |
| Stripe objects | **No price IDs and no lookup keys.** Dashboard and plans checkout use inline `price_data` + `product_data` (`Hosting plan (monthly)`, `<Tier> add-on (monthly)`), so every checkout creates an ad-hoc product. The outreach claim/publish path uses fixed product IDs **`freeplug_hosting_monthly`** and **`freeplug_addon_{basic,plus,pro}_monthly`** (created on demand) with inline prices. Metadata: `type=hosting`, `hosting_monthly_cents`, `addon_tier`, `include_addon`. | `checkout/hosting/route.ts:154-179,205-210`; `src/lib/outreach/billing.ts:58-59,114,213-254` |
| Plan changes | Customers change plans in the Stripe Billing Portal (`billing-actions.ts:30`). Ad-hoc prices can't be offered as "switch plan" choices there **(unsure how the portal is configured today)**. | `active-subscription.ts:102-103` |
| DB | `outreach_sites.plan_hosting_cents`, `plan_addon_tier` with CHECK `('none','basic','plus','pro')` | `supabase/migrations/20260927050600_site_publish_and_url.sql:15,32-34`; `src/lib/outreach/schemas.ts:53` |
| AI edit quotas | **None in code.** L2 editor not built (Part B). | — |
| Support / SLA | Support hours Mon–Wed 1–2 PM, Thu–Fri 1–3 PM CT (~7 h/week), with a strict "no reply-time promise" | `src/lib/support-hours.ts:1-13` |
| Leads, analytics, forms | **None.** No visitor stats, no stored form submissions for customer sites, no call tracking. (`site_details_submissions` holds owners' details for review, not leads.) | grep of `src` |
| GBP, SMS, reviews | **None.** GBP shows up only as Pro copy and a `google_business_url` field on requests. SMS shows up only as Freeplug's own `sms:` support link (`src/lib/site.ts:13`). Reviews shows up only as the landing page's "Real reviews coming soon". | — |
| Terms | **No Terms page.** The footer "Terms & Conditions" link has `href: null` (`Footer.tsx:17`). | — |
| Copy drift | `CancelPlanView.tsx:267` says "**99.9% uptime guarantee**", which contradicts the no-guarantee policy (`TechStackSection.tsx:157`). Fix it in this round. | — |

**Bottom line:** today, paying more than $55 buys nothing extra. Priority itself is only a label.

---
## 2. Feasibility per perk (team = AI agents; Ezequiel is the only human)
Ezequiel's time is per customer per month **(est.)**.
| Perk | Exists | Must build | Outside service / cost | Ezequiel min/cust/mo | Verdict |
|---|---|---|---|---|---|
| **$55 Priority** queue jump | label + badge | sort the admin requests queue by step, show a badge on requests | none | 0 | **Launch** (small build) |
| **$65** small edits within 24 h | nothing | edit counter + "due by" field on requests | none | 0 if agents do the edit and the owner publishes (L1/L2) | **Launch, but not "24 h".** Support runs Mon–Fri, and Fri 3 PM → Mon 1 PM is 46 h. Promise **"done by the end of the next business day"**, which is still a time promise and Ezequiel's call. Source: support hours in code |
| **$65** 1 free small edit/month | Plus copy only | usage ledger (1 per billing period, no rollover) | none | 0 | **Launch** |
| **$75** monthly report: visitors | none | per-site Cloudflare Web Analytics + a monthly report job (Cron Trigger) + email | **Free.** Unlimited sites when proxied through Cloudflare, 10 if not ([CF limits](https://developers.cloudflare.com/web-analytics/limits/)) | 0 | **Launch** for sites on our Cloudflare hosting (Part B) |
| **$75** report: form fills | none | Part B's form endpoint must **store or count** submissions (`form_submissions`) | none (Resend already) | 0 | **Launch**, once a site's form runs through our endpoint (Gracia's is the first) |
| **$75** report: calls | none | count **"Call" button taps** (not calls) through the same analytics or event | Real call tracking needs a tracking number vendor **(cost not checked)**. Google wants the primary number to connect to the business and be under its control. Tracking numbers are commonly placed as primary with the real number as "additional", which carries NAP risk ([GBP guidelines](https://support.google.com/business/answer/3038177)) | 0 | Launch as **"call button taps"**. **No call tracking numbers** at launch |
| **$75** text alert per quote request | none | alert hook in the form endpoint | **SMS needs US A2P 10DLC.** Twilio lists sole proprietor $4 brand + $15 campaign vetting + $2/mo; low-volume standard $4 + $15 + $1.50–$10/mo; plus per-message fees, not checked ([Twilio 10DLC](https://www.twilio.com/en-us/phone-numbers/a2p-10dlc)). Registered under Freeplug as the sender, with the owner opting in to texts. | one-time signup ~1–2 h, then 0 | **Launch with an email alert (free, Resend). SMS later**, after Ezequiel signs up and registers |
| **$85** GBP kept current + 2 posts/month | Pro copy only | post drafts by AI; a GBP task list in admin | The owner adds our Google account as **Manager** (per customer). **API access is by application**: a GBP verified and active 60+ days, a live website, a Cloud project, review "within 14 days" ([GBP API prereqs](https://developers.google.com/my-business/content/prereqs)) | **~15–20 min** (est.) to post by hand until the API is approved, then ~0 | **Launch, done by hand** (Ezequiel's time), and automate after API approval. Watch the cost: at 20 customers, by hand is ~5–7 h/month |
| **$85** review requests to their customers | none | a "review link + message template" the **owner sends**. Later, optional email sending from the owner's domain | Google forbids incentives and **selectively asking happy customers** (review gating) ([Google UGC policy](https://support.google.com/contributionpolicy/answer/7400114)). FTC bans incentives conditioned on sentiment (16 CFR 465.4). If **we** send them: email = CAN-SPAM rules (opt-out, postal address), SMS = TCPA consent + a 10DLC campaign | 0 | **Launch as owner-sent link/QR + template** (no consumer data held by us). We send them only later, email-only, with a consent checkbox |
| **$100** seasonal refresh (photos, offer, seasonal page), 4×/year | photo upload pipeline, admin review | a seasonal-page section in `site.json` (Part B) + a reminder job | none. **Photos come from the owner** (no site visits) | ~10 min/quarter to approve (est.) | **Launch** (agents build, owner supplies photos) |
| **$100** 15-min planning call each quarter | none | a booking link in the dashboard (free calendar tool) | none | **~5 min/mo averaged + no-shows** (15 min × 4/yr) | **Launch**, capped at 1 per quarter, booked inside support hours |
| **$100** "we make their AI-builder changes for them" | none | = **done-for-you L2 edits** plus Part B **L3** (bring-your-own Bolt via PR, which we review) | Bolt is the owner's own cost if L3 is used (Part B B2) | 0–10 min per PR (est.; reviews by agents) | **Launch as "we make the change for you"** with our editor. L3 PR flow **later** (Part B build step 6) |

Capacity check (est.): at 20 Growth-partner customers that's ~20 calls a quarter, ≈5 h, plus GBP by hand at 20 × 15–20 min ≈ 5–7 h/month. **Ezequiel's hours are the bottleneck for $85 and $100**, not the code.

---
## 3. Recommended ladder (cumulative)
Discrete steps instead of a free slider: an amount between two steps would buy nothing extra and be confusing. This needs Ezequiel's confirmation (Q1).

| Step | Price | Adds (on top of everything below) | AI edits/mo (L2) | Realistic **at launch** | **Later** |
|---|---|---|---|---|---|
| **Starter** | $35 | Hosting on our Cloudflare setup, SSL, L1 quick edits (self-serve), email support in support hours | **5** | hosting + SSL now. L1/L2 when Part B ships | backups/alerts (see Q4) |
| **Priority** | $55 | Requests handled ahead of lower plans | **15** | ✅ (after the queue-sort build) | — |
| **Fast lane** | $65 | 1 small edit done by us each month (no rollover). Small edits by end of next business day | 15 | ✅ | — |
| **Leads** | $75 | Monthly report (visitors, form fills, call-button taps). Instant alert for each quote request | **40** | ✅ email alert + report (Cloudflare-hosted sites with our form) | SMS alert (after 10DLC) |
| **Get found** | $85 | GBP kept current (hours, photos), 2 posts/month, review-request kit | 40 | ✅ by hand (Ezequiel) + owner-sent review kit | GBP API automation. We send review emails |
| **Growth partner** | $100 | Seasonal refresh 4×/yr, 15-min planning call each quarter, we make AI-builder changes for them | 40 | ✅ refresh + call + done-for-you edits | L3 bring-your-own Bolt via PR |

**Part B reconciliation:** the three bands keep their quotas (5/15/40). The boundaries move to the step prices: Starter = $35; Standard = $55–$65; Priority band = $75–$100. Since nobody can pay $50–$54 any more, the 5/15/40 numbers don't change. **L3 bring-your-own builder moves to $100 only** (Part B left that open, decision 10), because every PR costs review time.

**Merge or replace Basic/Plus/Pro: replace, and grandfather.**
- Stop selling add-ons. Fold their content in: Basic's backups and alerts go into Starter (only if we actually deliver them, Q4), Plus's monthly edit goes to $65, Pro's GBP goes to $85.
- Existing subscribers keep their add-on line item, price and perks untouched until they choose a step. Stripe doesn't change existing subscriptions when new prices are created.
- Legacy entitlements are read from `addon_tier` metadata or the legacy product. A legacy plan's "step" = the highest step its monthly total reaches, so today's rule (hosting + add-on counts toward $55) keeps working.
- Edge case to accept: a legacy $35 + Pro ($50) customer keeps GBP even though new customers get it at $85 (Q5).

---
## 4. Build inventory: every surface that shows or enforces pricing
**H55** = hard-codes $55/5500 · **TIER** = hard-codes Basic/Plus/Pro · **RANGE** = hard-codes $35–$100 slider
| Surface | File:line | Flags | Change |
|---|---|---|---|
| Plans constants | `src/lib/plans/priority.ts:5,8-12,27-38` | H55 (strict copy at 8-12) | derive from ladder |
| Stripe config | `src/lib/stripe/config.ts:2-6,8-51,53-58` | RANGE, TIER | steps + `LEGACY_ADDON_TIERS` |
| Server plan resolver | `src/lib/outreach/plan.ts:1-18` | TIER, RANGE | `resolvePlanStep` |
| Zod schema | `src/lib/outreach/schemas.ts:53` | TIER | `planStep` enum |
| Hosting checkout API | `src/app/api/checkout/hosting/route.ts:48-71,136-141,154-179,205-210` | RANGE, TIER (strict error copy at 68) | price by lookup key, metadata `plan_step` |
| Outreach publish billing | `src/lib/outreach/billing.ts:58-59,151,213-254` | TIER | same |
| Outreach save/validate | `src/lib/outreach/server.ts:91,615,640,957` | TIER | store `plan_step` |
| Edit-entitlement lookup | `src/lib/stripe/active-subscription.ts:138-161` (name-prefix match), `167-180` | TIER | `getEntitlements()` |
| Hosting checkout card (shared) | `src/components/plans/HostingCheckoutCard.tsx:10-11,58,106-108,119-122,136-179` | RANGE, TIER (strict legend copy) | step cards |
| Plans page (dashboard) | `src/app/(dashboard)/dashboard/plans/page.tsx:21,58,62` | — | copy |
| Landing plans section | `src/features/landing/components/HostingPlansSectionUi.tsx:43,50` | TIER (strict) | copy |
| Claim flow | `src/app/claim/ClaimSteps.tsx:66-80`; `src/app/claim/page.tsx:163-181`; `src/lib/outreach/copy.ts:141` ("from $35") | TIER | show step name |
| Dashboard subscription details | `src/app/(dashboard)/dashboard/SubscriptionDetails.tsx:5-8,128-129`; data `dashboard-actions.ts:114-140` | H55 | step name + perks |
| Help chat | `src/lib/help/help-chat-content.ts:41,49,96,100-104,129-130`; `src/components/help/HelpChat.tsx:22-23,240`; `dashboard/help/layout.tsx:16-30` | H55, TIER, RANGE | rewrite answers, `hasIncludedEdit` |
| Help center page | `src/app/(dashboard)/dashboard/help/page.tsx:78,116,134,188,196,199-202` | TIER, RANGE | copy |
| FAQ | `src/app/faq/page.tsx:33` | TIER, RANGE | copy |
| About section | `src/features/landing/components/AboutSection.tsx:22` ("from $35") | — | ok as is |
| Admin outreach | `src/app/admin/outreach/page.tsx:15,22` | TIER | show step |
| Admin customers | `src/app/admin/AdminCustomersTable.tsx:4,16,160-165`; `src/app/admin/customers/page.tsx:65,90` | H55 | step badge |
| Admin requests (queue) | `src/app/admin/requests/page.tsx:22-27`; `AdminRequestRow.tsx` | — (no Priority at all) | sort by step, badge, due-by |
| Cancel page | `src/app/(dashboard)/dashboard/cancel/CancelPlanView.tsx:267` | — | remove "99.9% uptime guarantee" |
| DB constraint | `supabase/migrations/20260927050600_site_publish_and_url.sql:32-34` | TIER | new migration (don't edit an applied one) |
| Locked copy | `/workspace/freeplug-qa/freeplug-english-source-LOCKED-2026-09-24.txt` (lines ~292, 307-339, 380, 531-620) | strict entries | Sable updates |
| Tests | `src/lib/plans/priority.test.ts` (H55 ×15), `dashboard/SubscriptionDetails.test.tsx` (9), `api/checkout/hosting/route.test.ts` (6), `lib/help/help-chat-content.test.ts` (3), `lib/outreach/billing.test.ts` (2), `lib/outreach/server.test.ts` (2), `components/help/HelpChat.test.tsx`, `(dashboard)/DashboardChrome.test.tsx`, `dashboard/cancel/CancelPlanView.test.tsx` (1 each) | | update + new |

---
## 5. Build spec for Owen
New branch off `backup/box-build-2026-10-03`, **Stripe test mode only**. Run Arkitect diagnose before and verify after (Ezequiel's standard). Production and live Stripe wait for Ezequiel.
1. **`src/lib/plans/ladder.ts` (new, single source of truth).** `PLAN_STEPS = [{ id: 'starter'|'priority'|'fast_lane'|'leads'|'get_found'|'growth', name, monthlyCents: 3500|5500|6500|7500|8500|10000, lookupKey: 'freeplug_step_<id>_monthly', aiEditsPerMonth: 5|15|15|40|40|40, perks: string[] (cumulative, launch versions only) }]`.
   - Helpers: `stepById()`, `stepForMonthlyCents(total)` (highest step ≤ total, for legacy plans), `entitlementsFor({ stepId | legacy: { hostingCents, addonTier } })`. The return is `{ step, priorityRank (0–5), includedEditsPerMonth (0|1), nextBusinessDayEdits, leadsReport, quoteAlerts, gbpManaged, reviewKit, seasonalRefresh, quarterlyCall, doneForYouEdits, aiEditsPerMonth }`.
   - Legacy mapping: `plus`/`pro` ⇒ `includedEditsPerMonth: 1`; `pro` ⇒ `gbpManaged: true`; `priority` ⇒ total ≥ 5500 (today's rule).
2. **`priority.ts`:** `PRIORITY_MIN_MONTHLY_CENTS = stepById('priority').monthlyCents`. Keep the exported copy constants until Sable delivers the new strings. `qualifiesForPriority` ⇒ `priorityRank >= 1`.
3. **`config.ts`:** replace `HOSTING_MIN/MAX/DEFAULT` + `clampHostingCents` for **new** checkouts with `resolvePlanStep(id)`. Rename `ADDON_TIERS` → `LEGACY_ADDON_TIERS` (display and entitlements only, never offered). Keep `clampHostingCents` for reading legacy rows.
4. **Stripe price lookup:** `src/lib/stripe/prices.ts` (new). `getStepPriceId(stepId)` via `stripe.prices.list({ lookup_keys: [...] })`, cached per isolate. Fail closed (503) if missing. A test-mode setup script `scripts/stripe-test-setup-ladder.mjs` creates 6 Products + monthly Prices with those lookup keys and `metadata.plan_step`. **Test keys only; refuse to run if the key starts with `sk_live`.**
5. **Checkout** `api/checkout/hosting/route.ts`: body `{ planStep }`. Reject `addonTier`/`includeAddon` with 400. One line item `{ price: getStepPriceId(step) }`. Metadata `type=hosting, plan_step`. The idempotency key uses `planStep`. Keep every existing guard (one plan per customer, open-session reuse/expire, 503 on Stripe failure).
6. **Outreach publish** `lib/outreach/billing.ts`: the same swap (`items: [{ price }]`). Keep the idempotency key format. `resolveOutreachPlan` → `resolveOutreachStep`.
7. **Migration** `supabase/migrations/2026100xxxxxxx_plan_steps.sql` (scratch first, Vera checks before any hosted apply):
   - `outreach_sites.plan_step text null` with CHECK in the six ids. Keep `plan_hosting_cents`/`plan_addon_tier` for legacy rows. A new claim must have `plan_step`.
   - `profiles.plan_step text null`, `profiles.plan_step_synced_at timestamptz`. This caches the entitlement for queue sorting. Written only by the service role in the webhook (RLS: owner select only; no client update).
   - `included_edit_uses(id, user_id, period_start date, request_id uuid unique, created_at)` with **unique (user_id, period_start)**, which enforces 1 per billing period. Service-role insert only.
   - `website_requests.due_by timestamptz null` (next-business-day edits).
   - Re-apply the revoke/grant pattern from Vera's restore work. Add the new tables to the privilege snapshot.
8. **Webhook** `api/webhooks/stripe/route.ts`: on `customer.subscription.created|updated|deleted`, compute the step from `price.lookup_key` or `metadata.plan_step`, falling back to legacy items, and write `profiles.plan_step`. Make it idempotent and retry-safe, the same as the email ledger.
9. **Entitlements** `active-subscription.ts`: replace `hasMonthlyEditAddon` (name-prefix match) with `getEntitlements(customerId)`, which reads lookup keys or metadata and handles legacy add-on products by `freeplug_addon_*` id or `addon_tier` metadata. Callers: `help/layout.tsx`, `SubscriptionDetails`, admin.
10. **Admin queue** `admin/requests/page.tsx`: join `profiles.plan_step`, order by `priorityRank desc, created_at asc` (oldest first within a step), and show a step badge plus `due_by`. `AdminCustomersTable`: the step badge replaces the Priority-only badge.
11. **UI**: `HostingCheckoutCard` becomes 6 step cards (name, price, perks, "Most popular" optional). The `embedded`/`onChoosePlan` props stay, so `plans/page.tsx`, `ClaimSteps.tsx` and the landing page all keep working. `SubscriptionDetails` shows the step name + perks + "Your included edit: used/available this month". The claim summary and admin outreach show the step name.
12. **Copy** goes through constants (`src/lib/plans/ladder-copy.ts`), so Sable's strings land in one file. Remove "99.9% uptime guarantee" in `CancelPlanView.tsx:267`.
13. **Not in this branch** (Part B or later): the L2 AI editor and quota enforcement (store `aiEditsPerMonth` only), the leads report job, form storage, the SMS alert, GBP API, and the L3 PR flow. Only perks marked ✅ in §3 appear in the copy.
14. **Tests:**
    - Update the 9 files in §4.
    - New tests: ladder cumulative perks; `stepForMonthlyCents` edges (3499/3500/5499/5500/10000); legacy mapping (35+Pro ⇒ GBP + 1 edit; 40+Pro = $55 ⇒ priority); checkout rejects add-ons and unknown steps and uses the lookup-key price; webhook sets `plan_step` and is idempotent; queue sort order; a second included edit in the same period is refused (DB unique); the setup script refuses `sk_live`.
    - A guard test: no `price_data` remains in hosting/outreach checkout (maintenance's one-time `price_data` stays).

---
## 6. Stripe changes, for Ezequiel's approval (test mode first; live only on his yes)
1. Create **6 Products** ("Freeplug Hosting: Starter" … "Growth partner"), each with **one monthly USD Price** ($35/$55/$65/$75/$85/$100), lookup keys `freeplug_step_<id>_monthly`, `metadata.plan_step`.
2. **Stop selling** Basic/Plus/Pro. Don't archive the existing ad-hoc or legacy products until no live subscription uses them.
3. **Existing subscribers: keep their current price and add-on (grandfathered).** No forced moves. A move happens only when the customer picks a step.
4. Moving to a step: replace the subscription's items with the step price. **Upgrades: immediate, prorated** (`proration_behavior: 'create_prorations'`, or `always_invoice` to charge now). **Downgrades: at period end** (subscription schedule), so nobody gets a credit mid-month. Prorations work by time used ([Stripe prorations](https://docs.stripe.com/billing/subscriptions/prorations)).
5. **Billing Portal:** allow switching between the 6 step prices only (upgrades prorated, downgrades at period end). **(unsure whether the portal setting for "downgrade at period end" exists as I describe; Owen confirms in test mode.)**
6. Webhook endpoint: no new event types needed (`customer.subscription.updated` is already planned in Part A).
7. Annual prices: none for now (Q8).

---
## 7. Customer copy for Sable (plain English; replaces the add-on lines)
- **Starter, $35/month.** Your website, hosted and kept secure. Change your hours, prices, photos and text yourself anytime.
- **Priority, $55/month.** Everything in Starter. When you ask us for a change, you're ahead of lower plans in line.
- **Fast lane, $65/month.** Everything in Priority. One small edit by us every month, like new hours, a photo swap or a price change. Unused edits don't roll over. Small edits are done by the end of the next business day.
- **Leads, $75/month.** Everything in Fast lane. A monthly email showing how many people visited your site, filled out your form, and tapped your call button. Plus an email the moment someone asks for a quote.
- **Get found, $85/month.** Everything in Leads. We keep your Google Business Profile up to date and post to it twice a month. You get a ready-made message and link to ask your customers for reviews.
- **Growth partner, $100/month.** Everything in Get found. Each season we refresh your site with your new photos and offers. A 15-minute planning call with us every quarter. Tell us what you want changed, and we make it for you.
- Existing customers: "Already have an add-on? You keep it at the same price. You can switch to a plan anytime in Manage billing."
- Rules for Sable: no reply-time promises beyond "next business day" (if Ezequiel approves it), no ranking or lead guarantees, and "call button taps" rather than "calls". The FAQ, help chat, help center, landing, plans, claim and dashboard strings all change (see §4). The locked-file entries need a new [STRICT] set.

---
## 8. Only Ezequiel can do
- Approve the ladder, prices, step names, and the grandfathering policy.
- **Create the live Stripe products/prices and the Billing Portal settings**, or say yes to Owen doing it. Approve any live price change.
- **Run the quarterly calls** ($100), and decide whether calls fit inside support hours.
- **GBP:** own or provide the Google account that customers invite as Manager. Do the posting and updates by hand until the API is approved. **Apply for GBP API access** (needs a GBP verified 60+ days, a live website, a Cloud project, and an email that's an owner/manager on that GBP).
- **SMS (later):** sign up with an SMS provider (e.g. Twilio), register the A2P 10DLC brand and campaign (business identity, EIN or sole-prop), pay the fees, and approve the opt-in wording.
- Approve the review-request kit wording, and decide whether we ever send review emails on owners' behalf (who the legal sender is, opt-out and postal address).
- Cloudflare: enable Web Analytics per customer site/zone. Per-client Resend domains and keys, as already planned.
- Approve the time promise ("next business day") and a Terms page that states plan perks, no-rollover rules and cancellation. **There's no Terms page today.**
- Any spend (SMS, call tracking if ever, Bolt for L3 is the owner's).
- Photos or site visits, if a customer wants more than owner-supplied photos (not in the ladder).

---
## 9. Open questions (only Ezequiel can answer)
1. **Discrete steps** (recommended) or keep the free slider with perks unlocking at thresholds?
2. Keep "within 24 hours", or change it to **"end of the next business day"** (recommended; weekends make 24 h impossible within support hours)?
3. Is the $65 included edit **done by us** (agents) with no human review, or does he want to see each one?
4. Basic promised "Regular backups" and "Downtime alerts". **Is anyone delivering those today?** If not, should Starter include them (Workers versions + Git history for backups, a cron uptime check for alerts), or should the claim come out of the copy?
5. Grandfathering: honor legacy add-on perks (e.g. $50 legacy plan with GBP) **forever**, or until a date?
6. How many **live** subscribers have each add-on today? (Not checked; no Stripe reads were done.)
7. SMS alerts: worth the 10DLC signup now, or email-only until customers ask?
8. Annual billing (e.g. 2 months free)? Not in this draft.
9. Cap on Growth-partner customers (his call time and GBP time), e.g. a waitlist after N?
10. Do $75+ perks apply only to sites on our Cloudflare hosting (needed for analytics and form counts)? I'd say yes.
