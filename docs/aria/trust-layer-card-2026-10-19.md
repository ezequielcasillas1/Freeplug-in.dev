# Architecture card: Freeplug Trust Layer (paid anti-spam / anti-hacker), Aria, Oct 19, 2026
Plan only. Nothing is built or deployed. Hold rules apply.

## 1. What each tier actually does (must be real and deliverable; no "hack-proof" claims)
- **Shield $1/mo**: Turnstile on the site's contact/quote forms, a honeypot plus spam filter on form submissions, and Cloudflare's free managed WAF ruleset on.
- **Guard $3/mo**: everything in Shield, plus rate limiting on forms and login, Bot Fight Mode, uptime and security alerts to the owner, and a monthly protection report (blocked spam and threats).
- **Fortress $5/mo**: everything in Guard, plus custom WAF rules (country/ASN blocks on request), admin/login path lockdown, a weekly malware and defacement check of the site, and priority incident response (we act within 1 business day).
- **Caveat:** most of this is Cloudflare features we already have on our zones; customers pay for us managing it. Cloudflare's paid WAF managed rules (Pro, ~$20/zone/mo) cost more than $5, so they're NOT included at any tier. The copy must say "reduces spam and attacks", never "prevents all hacking" (FTC truth-in-advertising).

## 2. Contradiction: "non-refundable" vs. "cash out at 12 months"
- A balance the customer can cash out is a refund under another name, so the money isn't really non-refundable.
- **Recommend:** no cash-out. Payments are non-refundable service fees. At 12 months the customer chooses between keeping the credit toward a buyout or converting it to Freeplug service credit (edits, maintenance). That keeps both promises true.

## 3. Stripe and legal risk of cashable credits
- Holding customer money to pay out later looks like stored value or a deposit. That can trigger state stored-value and unclaimed-property rules (Texas included), and possibly money-transmitter questions.
- Stripe can't hold a customer balance for payout. Paying cash back would mean refunds (time-limited per card network, around 180 days, so they fail at 12 months) or outbound ACH payouts (Connect or other, with KYC). Large refunds also raise dispute and fraud flags.
- If Cheke insists on cash-out, get a Texas lawyer to review it first, and expect about +2 days of build plus payout tooling. Recommend avoiding it.

## 4. Fit with buyout ($500–$2,000) and "every dollar toward buyout"
- Under the Oct 17–18 rule, every paid dollar already counts toward buyout automatically, through the ledger. A separate "apply credits" button would contradict that and create double-count risk.
- **Recommend:** trust-layer payments flow into the same ledger automatically. The dashboard just shows "Trust Layer: $X of your total paid toward ownership". No button.
- If Cheke wants the button (opt-in), trust payments go into a separate pending bucket, and applying moves them into the ledger once, idempotently.
- Scale: at most $60/yr against a $500–$2,000 buyout, so it's a small sweetener, not a buyout path.

## 5. Build plan and effort (rough judgment, not measured)
- Stripe: 3 recurring prices, subscription Checkout, Billing Portal, and webhooks into the existing idempotent ledger. Test mode first, then live only with Cheke's rk_live key. Owen, ~1 day.
- State: a `trust_subscriptions` table (profile_id, site_id, tier, status, stripe_sub_id, started_at), service-role only with RLS, plus an entitlement check. Owen, ~0.5 day.
- Provisioning: apply tier settings to each customer site through the Cloudflare API (Turnstile widget, rate-limit and WAF rules, alerts), with tear-down on cancel. Owen, ~1.5–2 days. This is the real work.
- Dashboard UI: a tier picker, the credit-toward-ownership line, and a status and report card. Lina designs, Sable writes the copy, Owen builds. ~0.5–1 day.
- QA: Luma, ~0.5–1 day (webhooks, entitlement on and off, provisioning in a test zone, and no secrets).
- **Total MVP without cash-out:** about 4–5 days. Cash-out adds the lawyer review plus ~2 days.

## Dependencies before "live fast"
The base PRs (#9, #1, #2, #4) are still unmerged. Live Stripe isn't set up, Workers Paid is unconfirmed, and the team hold is on. Live needs all of those plus Cheke's go.

## Decisions for Cheke
1. Tier contents and names OK?
2. Cash-out or service credit (recommend service credit)?
3. Automatic toward buyout, or the button (recommend automatic)?
4. Lift the hold for a test-mode build?


---
# REVISION Oct 19, 10:53 AM CT: built around Cheke's choices (trust fund + cash-out + buyout button)

## Onboarding
- A short "Why we protect your site" step: we block spammers, hackers and abusers from getting at your business's information, because we run a serious company. Sable writes it, and no "hack-proof" claims.
- A tier picker for $1, $3 or $5 (Shield, Guard, Fortress, as in section 1), with "Skip for now" allowed. It uses Stripe Checkout for a subscription, test mode first.

## Trust credit bucket (separate from the buyout ledger)
- Each paid trust invoice adds to a **trust_credit** balance. It does NOT auto-add to the buyout ledger. FLAG: this is a deliberate exception to "every dollar toward buyout" for trust-layer payments only. Cheke should confirm it.
- The dashboard shows "Trust credit: $X" with two buttons.
  - **Apply to buyout**: moves the balance into the buyout ledger as one conversion row with a unique key (conversion id). The bucket goes to $0. It's one transaction, so it can never count twice.
  - **Cash out**: available only after 12 months of subscription, inside the cash-out window.
- Each dollar can only go one way. The bucket can't go negative, and both actions lock the row (SELECT FOR UPDATE).
- Refunds and disputes on a trust invoice subtract from the bucket first.

## Safest cash-out path (needs a lawyer check before live)
- **Do NOT use card refunds.** They're time-limited (about 180 days) and look like refunds, which breaks the non-refundable promise.
- **Use a payout:**
  - Stripe Connect Express. The customer onboards their bank, and Stripe does identity checks. We pay through Transfer then Payout. Connect has its own per-payout and active-account fees, and they eat into $12–$60 balances.
  - Simpler at low volume: manual ACH or a check, recorded in the admin with a payout row.
- **Treat it as a loyalty rebate, not a deposit.** The money is Freeplug revenue when paid. Cash-out is a rebate Freeplug grants under the terms, so we never hold the customer's money in trust. Don't call it a "trust fund" in legal or terms text; "Trust credit" is fine in the UI.
- **Terms to add (Trust Layer terms):**
  - Fees are non-refundable while you're subscribed.
  - Credit earns no interest and isn't a bank account.
  - Cash-out is available from month 12, within a set window (for example 60 days).
  - Unclaimed credit converts to service credit after the window, which avoids unclaimed-property questions.
  - Cancelling before 12 months keeps the credit for buyout only.
  - Fraud or chargeback forfeits it.
  - Freeplug may change the program with notice for future months.
- **Lawyer check (Texas):** whether it counts as stored value or money transmission, unclaimed property, consumer refund laws, and the tax treatment of rebates.
- **Economics flag:** a full cash-out means the protection was free. Cheke may want cash-out at a percentage (for example 50%), with the full amount only when applied to buyout. That's his call.

## Effort (rough judgment)
- MVP with the bucket and the buyout button: about 5 days (Owen; Lina/Sable on the UI and copy; Luma on QA).
- The cash-out payout flow adds about 2 days plus the lawyer review. Ship it after the MVP, before the first customers hit month 12, so there's no rush.

## Cheke decides
1. Confirm the trust-credit exception to "every dollar toward buyout".
2. The cash-out percentage (100% or partial).
3. The payout method (Connect or manual).
4. Lift the hold for a test-mode build.

---
# ADDITION Oct 19, 10:54 AM CT: onboarding and dashboard copy draft (Sable polishes it)
Name: **Trust Credit**. Not "Trust Deposit": "deposit" suggests we're holding the customer's money, which conflicts with the rebate setup. Not "trust fund" either.

## Onboarding step: "Help keep Freeplug safe"
Freeplug is built on trust. Spammers, hackers, and abusers go after small businesses for their customer info, logins, and leads. Your Trust Layer helps block them on your site and across the whole Freeplug community, so every business here is safer.

Pick your protection:
- **Shield, $1/mo**: Spam and bot blocking on your forms.
- **Guard, $3/mo**: Adds login protection, attack alerts, and a monthly safety report.
- **Fortress, $5/mo**: Adds custom firewall rules, weekly malware checks, and priority help.

Every dollar you pay builds your **Trust Credit**. Use it toward owning your website anytime, or after 12 months you can cash it out.*

[Choose protection]   [Skip for now]

*Payments are non-refundable while subscribed. Cash-out is available from month 12 for a limited window. See the Trust Layer terms.

## Dashboard card
**Trust Credit: $X**
Protecting your site and the Freeplug community since [date]. Plan: [tier].
[Apply to my website buyout]   [Cash out] (locked until [month-12 date])

## Copy guardrails
No "hack-proof" or "guaranteed" claims. The cash-out wording waits on the lawyer check, so the cash-out line stays out until it's cleared.

---
# ADDITION Oct 19, 10:55 AM CT: required onboarding with a free verify-identity path
- Onboarding is required, with no skip. Customers pick a paid tier ($1/$3/$5) or "Don't want to pay monthly? Verify your identity instead."
- Free path: ID document plus selfie (passive liveness and face match) plus a device and IP risk check. No Trust Credit builds, since nothing is paid.
- Proposed (Cheke confirms): free-path sites get Shield-level protection, because Turnstile costs us nothing.
- Limit verification attempts to 2 per account, so bad actors can't run up per-check costs.

## ID verification APIs (checked on vendor pages Oct 19, 2026)
| Vendor | Free amount | Catch |
|---|---|---|
| Didit | Until Oct 31, 2026: 500 free full checks a month (ID, passive liveness, face match, IP). Unlimited sandbox. | From **Nov 1, 2026** that becomes $10 credit a month, about 30 full checks, then $0.33 each. Active liveness, AML and white-label branding cost extra from the first check (white-label is $0.20). |
| Persona Startup Program | 500 free a month (government ID plus optional selfie), up to 12 months. | You have to apply and qualify (small or independent). The account is **deactivated after 12 months** unless you move to a paid plan. $1 per check over 500. |
| Stripe Identity | None. | $1.50 per submitted check (ID plus selfie), charged even when verification fails. Easiest fit, since we already use Stripe, and it has blocklist and duplicate-face detection. |
| Veriff | 15-day trial, 50 checks. | No free plan. $0.80 per check with a $49 monthly minimum. |
**Recommend Didit** at about $0.33 per new user after the free credit: one check per user, ever. Stripe Identity is the fallback.

## Background checks: recommend NOT doing them
- There's no free option. Certn is about $13.99 per check plus county fees, and Checkr is $29.99–$94.99 per report.
- The FCRA (Fair Credit Reporting Act) applies. We'd need a permissible purpose, and screening website customers is a gray area, not the clear employment case. It also needs separate written consent and the full adverse-action process (pre-notice, a copy of the report, a summary of rights, then a final notice) every time we deny someone because of a report.
- A safer non-FCRA option: Didit sanctions and watchlist screening at about $0.20 per check, if Cheke wants more than ID.

## Biometric law flag (Texas)
- An ID selfie is a biometric identifier under Texas CUBI (the Capture or Use of Biometric Identifier Act).
- We need informed consent before capture, can't sell it, must protect it, and must destroy it within 1 year after its purpose ends.
- Have the vendor hold the images. We store only the result (status, vendor session id, date) and never the images.

## Copy addition (Sable polishes it)
"Freeplug aims to be as free as possible. That's part of what makes us different. Protect your site for as little as $1 a month and build Trust Credit, or verify your identity once for free."
Free-path button: "Verify my identity (free, about 2 minutes)". Add the consent line: "We use [vendor] to check your ID and selfie. We keep only the result, not your photos."

## Effort change
The verify path (vendor integration, webhook, status table, gating onboarding, consent) adds about 1.5 days. The MVP is now about 6–7 days.
