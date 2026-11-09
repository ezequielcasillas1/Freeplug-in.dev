# Starter add-ons ($5 and $10 a month): decision card (Aria, FINAL v2, Sun Oct 4 2026, ~7:50 AM CT)
Research and drafting only. No code changes, commits, Stripe calls or hosted anything. Nothing is built until Ezequiel says yes, and he reviews it on localhost:3000 in Stripe test mode first.
- Code: `/workspace/freeplug-ladder/freeplug-landing`, branch `hosting-ladder-2026-10-03`. Refs are at `0a3871b` unless marked **@089dc11** (Owen's re-check). Retired add-ons come from `9345ae0`. Kit: `/workspace/gracias-cf-kit`; PHP original: `/workspace/gracias-lawn`.
- UI: Lina's sketch `/workspace/freeplug-qa/design/starter-addons-block-LINA-2026-10-04.md`.
- v2 changes: Owen's findings, add-ons end on any upgrade, charge on add, final question list.

---
## 1. Today (from code)
| Topic | What the code does | Ref |
|---|---|---|
| Retired add-ons | Basic $5 = "Regular backups", "Downtime alerts". Plus $10 = + "One small edit per month (no rollover)". Pro $15 = + "Google Business Profile kept current: hours, photos, one post a month" | `git show 9345ae0:…/stripe/config.ts:18-40` |
| What survives | `LEGACY_ADDON_TIERS`, for display and entitlements only, never offered. Backups and alerts are unlisted because "nothing delivers them yet". Legacy add-ons are matched by product id `freeplug_addon_<tier>_monthly`, name "<Tier> add-on", or `metadata.addon_tier` | `src/lib/plans/ladder.ts:284-298`; `src/lib/stripe/config.ts:24`; `src/lib/stripe/active-subscription.ts:180-200` |
| Steps and sellable | Starter, Priority, Fast lane sellable; Leads, Get found, Growth `sellable: false` | `ladder.ts:73-84` |
| Perks | Each step's `adds[]`, cumulative, turned into flags by `entitlementsFor`. `includedEditsPerMonth: 0 \| 1` | `ladder.ts:16-27,306-396` |
| Entitlements | `entitlementsForSubscription` finds the step by lookup key among non-tip items, so extra items **don't break it** (Owen). It returns step perks only, so add-on perks must be added | `active-subscription.ts:163-178` |
| Non-tip item call sites | All assume "every non-tip item = the plan": `tips.ts:43,72,103,111,309` and `change-plan.ts:283,420` **@089dc11**. The profile plan snapshot has no add-on column | Owen |
| Pending-switch bug | `pendingFromSchedule` returns **null when the next phase has more than one item**, so a schedule carrying add-ons (or a tip) would hide a pending downgrade | `change-plan.ts:229` **@089dc11** |
| Tips | Allowed only on a ladder step. Starter's total is $35–54 (tip ≤ $19), with no room for add-ons. Tip changes use `proration_behavior: 'none'` and the change-plan lock | `ladder.ts:112`; `tips.ts:38-44`; `change-plan.ts:519-547` |
| Edit counting | `included_edit_uses`, UNIQUE (user_id, period_start), written by admin "mark as small edit". That action reads **only active subscriptions** | `supabase/migrations/20261003180000_plan_steps.sql:186-225`; `src/app/admin/actions.ts:216-262` (`:249` **@089dc11**) |
| Edit size | No request type or size column. A small edit is defined only by the Fast lane copy: "like new hours, a photo swap or a price change". **No step includes a "big change"** | `ladder-copy.ts:43-44,51,53` |
| Maintenance | Quote-first, "$50, up to $100", "small content tweak vs. broader overhaul". The checkout route has no UI and takes the amount from the caller | `src/lib/plans/maintenance-copy.ts:3-13`; `src/app/api/checkout/maintenance/route.ts:13-19` |
| Quote form email | **No email reaches the owner** (Owen confirmed). The PHP original sends quotes to the 72 After inbox. The `/api/quote` Worker source is **missing from the box**. Freeplug collects `quote_email` at claim but never uses it | `gracias-lawn/site/assets/inc/sendemail.php:49-50,120`; `gracias-cf-kit/docs/LAUNCH-CHECKLIST.md:20`; `site/contact.php:79`; `src/lib/outreach/details-state.ts:98` |
| Uptime, backups, analytics, GBP | **None.** No monitor, backup job, Cron Trigger, analytics beacon, form counter or GBP API. The kit's CSP would block Cloudflare's beacon | `kit.config.json:41-43`; `wrangler.jsonc`; `help/page.tsx:145` |
| Total Paid | Adds the full `amount_paid`; there's no separate buyout counter (Owen). Add-ons would show in Total Paid, which is correct for a "paid" figure | webhook `invoice.paid` **@089dc11** |

---
## 2. Decisions
**D1. Sellable list (Starter only, recurring monthly):**
| Add-on | Price | Status | Definition / why |
|---|---|---|---|
| **+1 small edit** | $5 | **Sell** | ~15 min on existing content: text, a photo, hours, prices, a phone number, a typo. No new sections. Counted in `included_edit_uses` (max 1 per period). No next-business-day target; that stays Fast lane's |
| **Big change** | $10 | **Sell** | One job up to ~1 hour on existing pages: add or rearrange one section, a new service block with photos, refresh a gallery, rewrite one page's copy (Sable writes it if needed). One a month, no rollover, counted in a new `big_change_uses` |
| **Visitor snapshot** | $5 | **Coming soon** | Not sold until built (§4) |
| Quote alert, downtime alerts, backups, Google hours sync | — | **Dropped** | The quote email is basic form function (D7). Alerts and backups are hygiene, not extras (D6). Hours sync is GBP hand work at ~15–20 min per customer per month, so it loses money at $5 until the Google API is approved |

**Not covered by either add-on:** a new page, a new feature or integration (forms, booking, payments), a redesign, or anything over ~1 hour. That's one-time maintenance, quoted first. If a big change turns out bigger, we quote it; the customer can say no and keeps the month's change.

**Honest note:** $10 for up to an hour is about **$10/hour** of Ezequiel's or a reviewer's time, and the $5 edit is about $20/hour. It only works if agents do the work and a person just approves (Q5).

**D2. Cap, enforced on the server from live Stripe prices:** the customer is on Starter, doesn't already have that add-on, has at most 3 add-on items, and add-ons total ≤ 1500 cents.
- Starter + add-ons + tip stays ≤ $54. The tip ceiling shrinks as add-ons are added.
- *Why:* everything stays below Priority's $55.

**D3. Add-ons end on any upgrade off Starter.**
- *Why:* Starter + both add-ons carried into Priority would cost $70, more than Fast lane ($65), which already includes the edit. Ending them also removes all carry-over logic.
- The upgrade confirm lists "Ending: …". If the small edit was on, it adds "Fast lane includes 1 small edit a month."
- A downgrade back to Starter re-adds nothing, same as tips.
- Entitlements come from step + add-on items, never from the dollar total.

**D4. Billing.**
- **Adding** charges the prorated amount now (`always_invoice`), so a big change is paid before it's delivered.
- **Removing** takes effect at period end, and the perk stays until then.
- Buying or removing is **refused while a plan switch is scheduled**, same as tips. Everything runs under the change-plan lock, and the subscription is re-read from Stripe after each change.
- Each add-on is its own price and item (quantity 1): lookup keys `freeplug_addon_small_edit_monthly`, `freeplug_addon_big_change_monthly`, `freeplug_addon_snapshot_monthly`.
- Product ids `freeplug_extra_<key>` and names "Freeplug extra: …", **never** "Basic/Plus/Pro add-on", so the legacy matcher can't misread them.
- Admin and invoices show each add-on on its own line.

**D5. Pay-to-own:** add-ons don't count (default; Q6).

**D6. Alerts and backups:** build them DIY into Starter for everyone (cron Worker + R2, about **$0–5/month for ~100 sites**, R2 storage ~$0.23/month; a paid monitor would be ~$40–50/month). Separate card later (Q8).

**D7. Quote email to the owner:** make it standard for every site (owner's `quote_email`, with 72 After optionally copied). That means rebuilding the missing `/api/quote` Worker. Separate item (Q7).

**D8. Copy fixes after approval (Sable):** maintenance becomes "jobs over about 1 hour, a new page or feature, quoted first", and "small content tweak" moves to the $5 edit. Also drop the unbacked "security monitoring" line (`cancel/CancelPlanView.tsx:298`).

**D9. UI (Lina):**
- An "Add-ons for Starter" block after the step list, before the tip card, shown only while Starter is selected. Toggle cards show price + one line, and the snapshot gets a "Coming soon" badge.
- **One shared total** in the action area / sticky bar ("Starter $35 · Add-ons $15 · Tip $4 · $54/month"); the tip card shows only the tip.
- Locked while a switch to Starter is pending.
- On mobile, collapsed to one row when not on Starter.

**D10. Database** (migration after `20261003220000`): `big_change_uses` mirrors `included_edit_uses` (UNIQUE user_id + period_start, service-role insert, owner reads), with an admin "Mark as big change" button. The profile plan snapshot gains an add-on column (display and queue only); Stripe stays the source of truth.

---
## 3. Conflicts (to fix in the build)
- **C1. The non-tip = plan assumption** sits at 7 call sites (§1). Split items into step / add-ons / tip everywhere, so the plan price, tip range, upgrade builder and previews ignore add-ons. Upgrades then delete add-on items explicitly (D3), and preview must still equal invoice.
- **C2. `pendingFromSchedule` hides multi-item phases** (`change-plan.ts:229` @089dc11). Fix it before any phase can carry an add-on.
- **C3. The admin edit actions read active subscriptions only** (`admin/actions.ts:249` @089dc11). Decide past-due or trialing behavior for both counters.
- **C4. The Leads perks get thin.** With the quote email made standard, Leads' `quoteAlerts` perk is empty as written. Leads needs its texts and call-tap report to stand on its own when built.

---
## 4. Size (est., Owen)
| Work | Dev-days |
|---|---|
| Item split (C1, C2) | 5–7 |
| Buy / remove + UI | 2–3 |
| `big_change_uses` + admin button | 1–1.5 |
| **Edit + big change add-ons total** | **~8–11** |
| Visitor snapshot, later: Cloudflare Web Analytics beacon (CSP must allow the cloudflareinsights domains; soft limit 10 sites per account), GraphQL pull, monthly cron, Resend | 3–4 (5–6 with a self-hosted fallback) |

## 5. QA cases for Vera (test mode, :3000)
1. Starter can buy each built add-on once. The server refuses any extra item past the $15 total or 3 items. Priority and above can't buy.
2. The tip ceiling shrinks with add-ons; the total never passes $54.
3. Adding charges the proration now (one invoice line per add-on). Removing keeps the perk to period end.
4. Buying or removing while a downgrade is scheduled is refused, and the pending downgrade still shows (C2).
5. Upgrade off Starter ends every add-on. The confirm lists them, and preview = invoice.
6. A second small edit or a second big change in one period is refused by the database.
7. Two concurrent toggles → one change (lock). Legacy plans see no block.

## 6. Questions for Ezequiel
1. **The list:** +1 small edit ($5) and big change ($10) now, visitor snapshot ($5) coming soon, the rest dropped?
2. **Cap:** add-ons ≤ $15/month, with Starter + add-ons + tip ≤ $54?
3. **Upgrades:** add-ons end on any upgrade off Starter?
4. **Billing:** charge the prorated add-on now, so a big change is paid before it's delivered?
5. **Big change at $10:** OK with up to an hour of work for $10 (≈$10/hour)? Alternatives: $15–$20, or a 30-minute cap.
6. **Pay-to-own:** add-ons don't count?
7. **Quote email:** make the owner quote email standard for every site (rebuild `/api/quote`)?
8. **Alerts and backups:** build them into Starter for everyone later (~$0–5/month DIY)?
