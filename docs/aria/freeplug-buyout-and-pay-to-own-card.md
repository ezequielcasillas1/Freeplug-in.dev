# Freeplug buyout + pay-to-own + site handoff: decision card (Aria, DRAFT v1, Sat Oct 3 2026, ~3:35 PM CT)
Research and drafting only. No code changes, commits, Stripe calls, GitHub calls or hosted anything. Nothing is built until Ezequiel signs off; review on localhost:3000 (my desktop) first.
- Code read: `/workspace/freeplug-ladder/freeplug-landing`, branch `hosting-ladder-2026-10-03` (HEAD `706f812`, tipping at `34e9479`/`d031431`/`dd6e56d`/`c29f151`) plus its **uncommitted** working tree (22 files, "round 5b"). Paths below are relative to `freeplug-landing/` unless they start with `/workspace`.
- Client site example: `/workspace/gracias-cf-kit` (Gracia's Lawn). Style follows `freeplug-hosting-ladder-card.md`.
- **(unsure)** = needs checking. **(est.)** = my estimate.

---
## 1. How buyout works today (from code)
| Topic | What the code does | Ref |
|---|---|---|
| Rule on record | "Monthly payments do not count toward owning the site." One-time fee, owner sets the price | `src/lib/buyout/buyout.ts:3-18` |
| Asking | Client clicks "Request a buyout quote" (dashboard + cancel page). It **marks or creates a `website_requests` row** with `is_buyout = true`. One open request per client. **No email is sent** | `dashboard/buyout-actions.ts:9-41`; `buyout.ts:138-181`; `dashboard/page.tsx:198-202`; `cancel/CancelPlanView.tsx:224-230,299-303` |
| Where the fee lives | `website_requests.buyout_price_cents` (cents, null = not quoted), admin-only by trigger; needs `is_buyout` | `supabase/migrations/20260925204000_…buyout_price_cents.sql:22-29,35-70`; `20260925204500_…is_buyout.sql:24-25,30-66,76-80` |
| Setting it | Admin → Requests: buyout badge + price box → `adminSetBuyoutPrice` ($1–$500,000, whole dollars) | `app/admin/actions.ts:177-214`; `AdminBuyoutCell.tsx:26-31`; `AdminRequestRow.tsx:99-104`; `buyout.ts:48-50` |
| Charging it | **Nothing.** No buyout checkout, no Stripe object, no webhook, no handoff. The client "hears about it from the owner (quick email)". The client UI never shows the price | `AdminBuyoutCell.tsx:27-29`; `BuyoutCard.tsx:21-40`. The only one-time Checkout is maintenance (`api/checkout/maintenance/route.ts:45-50`) |
| Copy | FAQ + help chat: "one-time fee… covers your finished website. Moving your domain is handled separately." | `buyout.ts:30-32`; `faq/page.tsx:44-46`; `help-chat-content.ts:85-94` |
| Per site? | **No `sites` table.** The fee hangs off a request row. `outreach_sites` is per site, but only for outreach-claimed sites, server-only (no customer grants), and `claimed_by … on delete set null`. Request-website clients have no site row. One hosting plan per client | `20260927050100_outreach_sites.sql:13-35,21,43-44`; `api/checkout/hosting/route.ts:130` |

**The "buyout counter" isn't a buyout counter.** It's `profiles.cumulative_website_value_paid_cents` (`20260402120000_profiles_and_website_requests.sql:6`), left over from an older "website value" pay-to-own model:
- The `invoice.paid` webhook adds to it: `prev + inv.amount_paid` at **HEAD** (`route.ts:196` in `git show HEAD`), so tips count.
- **The tip fix exists but is uncommitted.** The working tree has `BUYOUT_COUNTS_TIPS = false` (`src/lib/plans/ladder.ts:105-112`) and `buyoutValueCents()` (`src/lib/plans/tips.ts:141-150`), so it adds amount paid minus tip lines (`route.ts:175,192-199`). `HOSTING-LADDER-NOTES.md:125` still says "counts the full amount".
- **What reads it:** the dashboard "Total Paid" (`dashboard-actions.ts:345`, `QuickStats.tsx:33-35`), the cancel page (`cancel/actions.ts:69,86,96`), admin "Paid (cumulative)" (`AdminCustomersTable.tsx:155-160`), and a QA-only override (`admin/actions.ts:135-170`). Nothing ownership-related reads it in the app.
- **Dormant pieces of the old model are still in the DB:** `profiles.website_value_target_cents` (`20260402120000:5`), `website_transfer_notes`/`_acknowledged_at`, and the `acknowledge_website_transfer()` RPC. The RPC is granted to `authenticated` and passes when `cumulative >= target` (`20260403120000_website_transfer_handoff.sql:2-24`; `20260404100000_close_website_request_rpcs.sql:28-58`). The app uses none of it beyond types (`src/types/supabase.ts:11,16-17`).

**billing_ledger:** `id, profile_id, stripe_invoice_id (unique), amount_cents = amount_paid, created_at` (`20260402120000:90-100`). The owner can read their own rows (`20260403120000_billing_ledger_select_own.sql:2-6`). The tipping migration adds **`tip_cents`** (local only, r13 set: `20261003200000_tipping.sql:32-41`). It's still one row per invoice, so it can't separate proration, one-time lines or refunds.

**Webhook:**
- Signature verified (`route.ts:29-39`).
- Handles only `checkout.session.completed`, `customer.subscription.*` and `invoice.paid` (`route.ts:55-138`). **No `charge.refunded` or `charge.dispute.created`.**
- The ledger insert is idempotent on the invoice id (`184-187`). The profile total is read-modify-write (`192-204`).

**What a client site is:**
- An Envato **PHP** template filled in by us (`site/`, 51 PHP files incl. unused demo pages).
- Rendered at build time to **static HTML** in `dist/` (9 pages + `assets/`, `_headers`, `_redirects`), served on Cloudflare Workers static assets.
- The quote form posts to a Worker at `/api/quote` (`/workspace/gracias-cf-kit/package.json` description; `kit.config.json:25-26`; `dist/contact.html:159`).
- It lives **only on the box**: the kit's git repo has **no commits**, the Worker source isn't in the kit (`/workspace/kits/php-envato-cf/worker/src` is empty), and `live_url` is a URL typed by admin (`src/lib/outreach/billing.ts:188`). The per-site GitHub repo is planned, not built (`freeplug-cloudflare-and-owner-editing-card.md:327-336`).
- **There is no export today. It's new build work.**

---
## 2. Recommendations
**R1. Two separate paths that never mix.**
- **Buyout** = the admin fee. **Pay-to-own** progress never lowers it.
- The Plans page shows both side by side: "Buy your site now for $X" / "You've paid $Y of $Z toward owning it". Whichever finishes first wins, and the other then disappears.
- Pay-to-own is **off by default**, and Ezequiel turns it on per site in admin.
- *Why:* one number per path is easy to explain and can't be gamed by stacking.

**R2. What counts toward pay-to-own:**
- Counts: only the **plan part of paid invoices**: the step price lines (and legacy hosting/add-on lines), **including prorated upgrade charges**.
- Doesn't count: tips, the buyout, maintenance or any other one-time charge.
- Refunds and chargebacks subtract.
- Built from **Stripe invoice lines**, not `billing_ledger.amount_cents` (the tip and everything else is mixed in there).
- The tip-exclusion fix for the old counter **already exists behind `BUYOUT_COUNTS_TIPS=false` but is uncommitted**. See Conflict C2 for what that column should really do.
- *Why:* the plan price is the only part that pays for the site; tips are a thank-you.

**R3. The target, per site:**
- Admin field `own_target_cents`, defaulting to **$1,000** when pay-to-own is turned on.
- **Fixed and shown** to the client once counting starts (`own_started_at`).
- Ezequiel can **lower** it anytime but **never raise** it once a client is counting (DB check).
- Every change is logged (who, when, old → new).
- *Why:* a moving goalpost would break trust and invite disputes.

| Plan | Months to $1,000 (est., no tips, no refunds) |
|---|---|
| Starter $35 | 29 |
| Priority $55 | 19 |
| Fast lane $65 | 16 |
| Leads $75 / Get found $85 / Growth $100 | 14 / 12 / 10 |

**R4. Cancel, downgrade, upgrade.**
- **Cancel:** progress is kept and continues if they come back. By default it's kept for as long as the account exists and erased with account deletion (Q2: or an expiry such as 12 months).
- **Downgrade:** kept, grows more slowly.
- **Upgrade:** grows faster.
- *Why:* nobody should lose what they paid for by pausing.

**R5. When they reach it (updated: a buyout never touches the subscription):**
- The site is marked owned (`own_reached_at`, conditional set "where null", so it happens once) and the counter stops.
- Ezequiel and the client each get one transactional email (Resend, `email_sends` claim pattern).
- The client gets the **same handoff as a buyout** (§3).
- **The subscription is left exactly as it is**: the client keeps paying monthly, and we keep hosting and editing as usual. No "keep hosting or cancel" prompt, just an optional line: "You can cancel hosting anytime in Cancel options."
- The same applies to a paid buyout.
- *Why:* owning the files and paying for hosting are separate choices; changing billing automatically surprises people.

**R6. Both paths deliver the same thing:** the site files only. Not the domain, hosting or future edits.
- **Envato licensing:** each template's license must allow handing the files to that client. Ezequiel or Lina checks this per site **before** any handoff, and it's a required admin checkbox.

**R7. Database** (new migrations numbered after `20261003210000`, scratch first, Vera checks):
- **`site_ownership`** (new, one row per client site): `profile_id` (FK profiles, on delete cascade), `outreach_site_id` (nullable), `buyout_price_cents`, `pay_to_own_enabled` (default false), `own_target_cents`, `own_started_at`, `own_reached_at`, `owned_via` (`buyout`|`pay_to_own`), `envato_license_ok_by/at`.
  - It's new because there's no sites table (§1).
  - The existing `website_requests.buyout_price_cents` stays as the quote history, and admin "set price" also writes the current fee here.
- **`ownership_credits`**: one row per Stripe **invoice line id** (unique), `amount_cents` (negative for refunds and disputes), `source_event_id`, `kind`. Progress = `SUM`, never a running total.
- **`admin_audit_log`**: new (no general audit table exists; `outreach_photo_moves` is migration-only, `20260927050800:110-130`). Holds target changes, toggles, fee changes, grants, transfers and revokes.
- **`site_handoffs`**: repo name, GitHub user id, granted/transfer-due/transferred/revoked times, zip download log.
- **RLS:** forced on all four. The owner reads their own `site_ownership`/`ownership_credits`/`site_handoffs` rows. Only the service role writes (same guard trigger as `outreach_guard_service_role_only`, `20260927050100:49-76`).
- **Retire the old RPC:** revoke `acknowledge_website_transfer()` from `authenticated` (C3).
- **Backfill:** Ezequiel's call (Q1). The default counts from when pay-to-own is turned on.

**R8. Stripe.**
- **Pay-to-own: nothing new to sell.**
  - On `invoice.paid`, read the lines and keep those whose price lookup key is `freeplug_step_*_monthly` (`ladder.ts:69,79-84`), plus legacy hosting/add-on lines (`config.ts:23-24`, `active-subscription.ts:155-161`). Exclude `freeplug_tip_monthly` (`ladder.ts:99`, `tips.ts:65`).
  - Add `charge.refunded` and `charge.dispute.created` (and `charge.dispute.closed` for wins) → negative credits, split across the invoice's plan lines in proportion.
- **Buyout:** today it isn't charged at all (§1). Needs a one-time Checkout (`mode: 'payment'`, like maintenance) with metadata `type=buyout`, `site_ownership_id`. On `checkout.session.completed` + `payment_status=paid`, check `amount_total == buyout_price_cents`. With no invoice, it never touches the ledger or credits.

**R9. Copy (Sable writes, Wren fits):**
- A Plans progress line ("You've paid $Y of $Z toward owning your site").
- "What owning includes": your site's files. "What it doesn't": domain, hosting, future edits.
- An FAQ: pay-to-own vs buyout, what counts, cancel, refunds.
- A **Terms page** (none exists today; ladder card §1) covering ownership, the hold and that file rights depend on payment.
- **Never** "rent-to-own", "lease", "loan", "financing" or "installments".

---
## 3. Handing over the site (both paths)
**H1. A fresh, cleaned repo per client, never our working repo.**
- Built at handoff from that client's site only. It contains the **rendered static site** (`dist/` HTML + `assets/`), an `.htaccess` for clean URLs (Cloudflare's `_redirects` is ignored by Apache/LiteSpeed hosts like Hostinger), a ready-to-use quote form (H3), `README` + the hosting guide.
- **Not included:** the Envato PHP source and its unused demo pages, build scripts, `kit.config.json` (it has internal notes, e.g. `:37`), Freeplug platform code, the Worker, `.env`, keys, Turnstile keys, other clients' data, or admin and AI-builder internals.
- No git history: one initial commit.
- Gate before any access: **gitleaks** (the kit already wires it: `package.json` `secrets:scan`) plus a denylist scan for every other client's names and domains. Both must pass.
- On GitHub under the **72After org**, private, one repo per client, including sites built in Cursor Origin.

**H2. Access and revocation, stated honestly.**
- Access starts only after the final payment **succeeds**: read access as an outside collaborator, plus a zip download.
- A **14-day hold** follows, then the repo transfers to the client's own GitHub account (if linked; they must accept within one day, per [GitHub docs](https://docs.github.com/en/repositories/creating-and-managing-repositories/transferring-a-repository)).
- A refund or dispute during the hold → access removed automatically by the webhook, handoff marked `revoked`, Ezequiel emailed.
- **Honest limit:** once files are cloned or downloaded they can't be taken back. After that, the terms (rights to the files depend on payment) and Stripe dispute evidence (access log, delivery record) carry it, not code. Disputes can arrive ~120 days later; the terms say so (Q5: longer hold?).
- Every grant, transfer and revoke goes into `admin_audit_log`.

**H3. The hosting guide.**
- Sable writes it, Owen supplies and checks the steps, Wren fits it, Vera tests it.
- It covers:
  - Uploading through the host's File Manager or FTP into `public_html` (Hostinger), plus one free static host.
  - "This isn't a WordPress theme. It's plain files, which work on most WordPress hosts."
  - **The quote form:** our `/api/quote` Worker won't run elsewhere. The export includes a ready `contact.php` mail script (Hostinger/PHP hosts) and a form-service option for static hosts.
  - Pointing their domain at the new host.
- Vera tests on a local `php -S` server and a free static host. A real Hostinger test costs money, so it needs Ezequiel's yes.

**H4. Envato licensing** (R6) is checked before the repo is even built.

---
## 4. Security (Ezequiel: "can clients hack into the repo / secure key?")
- **The client never holds a key, unlock link or token.** Our server grants access; nothing on the client side can unlock it.
- Access happens **only** after Stripe's **signed** webhook (verified server-side, as today at `route.ts:29-39`). It's idempotent through the claim pattern (unique line id / session id + a conditional `own_reached_at`/`handoff` insert), and the server checks the money:
  - buyout: `amount_total == buyout_price_cents`
  - pay-to-own: `SUM(ownership_credits) >= own_target_cents`
- A **GitHub App we own**, installed on the 72After org **only on client export repos**, adds the client's **verified** GitHub account. Verified = linked via GitHub OAuth from their Freeplug account, so nobody can type in someone else's username.
- Transfer only after the hold. A refund or dispute during the hold revokes.
- Admin sees every grant and can revoke anytime, with a log.
- Private repos, **no shared repo**, so one client can never see another's.

---
## 5. Conflicts
- **C1. Buyout isn't charged anywhere today.** The "fee" is a number on a request row, and payment is arranged by hand. R8's buyout checkout, R7's `site_ownership`, the Plans "Buy now" button and the §4 amount check are all **new build work**. The fee being per request (not per site) is also why I'm moving the current fee to `site_ownership`.
- **C2. Excluding tips from the old counter makes "Total Paid" wrong.** Its only readers are "Total Paid" displays (§1). With `BUYOUT_COUNTS_TIPS=false`, a client who tipped sees less than they really paid. The flag is also **uncommitted** (HEAD still adds `amount_paid`).
  - Recommendation: **don't** use that column for ownership. Restore it to "total paid" (flag true, or `SUM(billing_ledger.amount_cents)`), and build pay-to-own from `ownership_credits`.
  - That reverses decision 2's "fix the current counter" and needs your OK.
  - The counter also drifts: if the profile update fails after the ledger insert, the webhook still answers 200 and a redelivery stops at 23505 (`route.ts:184-187,202-204`). Another reason for SUM-based progress.
- **C3. A dormant self-serve "ownership" RPC exists.** `acknowledge_website_transfer()` (granted to `authenticated`) checks the old counter against `website_value_target_cents`. If anyone ever sets that target, a client could self-confirm a handoff with tips counted. Revoke it in the new migration. This is also the same 20260403120000 version tangle Owen is repairing in r13, so coordinate with him.
- **C4. "Filter by price lookup key" misses legacy plans.** Pre-ladder subscriptions use ad-hoc `price_data` products with no lookup key. The line filter must reuse the ladder's tier classifier (`tierItems`/`entitlementsForSubscription`), not lookup keys alone.
- **C5. `email_sends` alone can't make the "reached" email once-only.** It's keyed per Stripe event and pruned after 30 days (`20261003160000:18-29,34`). A refund-then-recross would be a new event. The real once-guard is `own_reached_at` set "where null". Use `email_sends` only for retries of the same event.
- **C6. Erase-on-delete vs dispute evidence.** Erasing ownership rows with the account (R4) also erases the access log Stripe evidence needs for ~120 days. Proposal: keep `site_handoffs` + audit rows (Stripe ids and times only, no PII) for 180 days after deletion (Q8).
- **C7. GitHub App can't necessarily do the transfer (unsure).** GitHub's API docs (Enterprise 3.9 reference) say the repo-transfer endpoint needs a personal or OAuth token, not an App installation token. Grant and revoke via the App work. For the transfer: Owen tests a user-access token from our App in a test org; the fallback is **Ezequiel clicks Transfer by hand** (logged in admin). Never a personal access token in code.
- **C8. No export and no site repo exist.** The Gracia's kit repo has zero commits and the Worker source isn't on the box (§1). The export builder, the guide and the Freeplug GitHub OAuth link are all new.
- **C9. Owen's pointers, checked:**
  - `is_buyout` + `buyout_price_cents`: confirmed, but the `is_buyout` migration header still says "PENDING Ezequiel's decision" (`:1`). I can't verify it's on hosted from here.
  - The flag: confirmed, uncommitted.
  - "Landing-page buyout cards": **not found.** Only the dashboard and cancel-page cards plus the public FAQ entry exist.
  - `HOSTING-LADDER-NOTES.md` has no buyout file/line list (only `:125`).

---
## 6. QA cases for Vera (test mode, local :3000)
1. Pay-to-own off by default; the Plans page shows the buyout line only.
2. Turned on: target defaults to $1,000. Lowering works, raising after `own_started_at` is refused (DB), and both are logged.
3. Starter + $19 tip, 3 paid months → progress $105, not $162.
4. Upgrade proration counts; the downgrade month counts only the lower price.
5. A buyout payment and a maintenance payment add **0** to progress.
6. A full and a partial refund subtract proportionally; a dispute subtracts and a won dispute adds back.
7. Replayed `invoice.paid` / `charge.refunded` → no double credit (unique line id).
8. Cancel → progress kept → resubscribe → it continues.
9. Crossing the target: one `own_reached_at`, exactly one email each to Ezequiel and the client, even with two concurrent deliveries.
10. **The subscription is unchanged after both paths** (same items, price, tip, status, period end).
11. Buyout Checkout with a tampered amount, or a fee changed mid-session → no access.
12. **No access before payment succeeds** (open session, failed card, 3DS pending, `invoice.payment_failed`).
13. **Clean-repo scan:** a seeded fake key and another client's name in the source both block the build. The repo has one commit and no `.env`/`kit.config.json`/PHP source.
14. **Revoke during the hold:** a refund on day 3 → collaborator removed, handoff `revoked`, Ezequiel emailed. No transfer on day 14.
15. An unlinked GitHub user can't be granted; a typed username is ignored; client A can't see client B's repo.
16. Envato checkbox unchecked → handoff blocked.
17. Guide: the site plus `contact.php` work on `php -S`; the static host works with the form-service option.
18. Every RLS role: owner read-only, other clients none, anon none.

---
## 7. Only Ezequiel can do
- Sign off on this card. Create the **72After GitHub org** and our **GitHub App**, and approve its permissions. Set up GitHub OAuth for account linking.
- Add `charge.refunded`, `charge.dispute.created` and `charge.dispute.closed` to the Stripe webhook endpoint (test first, live on his yes).
- Approve the Terms page wording. Approve the paid Hostinger test if wanted. Do the per-site Envato license checks (or Lina).

## 8. Questions for Ezequiel
1. **Backfill:** count past payments, or only from when pay-to-own is turned on (default)?
2. **After a cancel:** keep progress for as long as the account exists (default), or expire it after e.g. 12 months?
3. **Default target:** $1,000 for every site, or a default per plan or site type?
4. **Who gets pay-to-own:** every new client, or only sites you turn on?
5. **Hold length:** 14 days, or longer (disputes can come ~120 days later)?
6. **GitHub required?** Must clients link a GitHub account, or is a zip download enough?
7. **"Total Paid"** on the dashboard: show everything paid incl. tips (my pick, C2)?
8. **After account deletion:** keep the delivery/access log 180 days for disputes (C6)?
