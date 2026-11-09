# Selling domains through Freeplug: decision card (Aria, DRAFT v1, Sun Oct 4 2026, 3:13 PM CT)
**Nothing has been built, bought, or signed up for.** Research only. Sources were read Oct 4, 2026. Anything I couldn't confirm is marked **unverified**; **(est.)** means my estimate.
- Code: `/workspace/freeplug-ladder/freeplug-landing`, branch `hosting-ladder-2026-10-03`, HEAD `089dc11`.
- Today: "Set up my domain" is a hand-handled request, and the customer buys the domain themselves (`src/app/(dashboard)/dashboard/domain/actions.ts:7`; copy "You buy and own your domain…" at `src/lib/outreach/copy.ts:170-171`; `supabase/migrations/20260927050700_site_domains.sql:1-3`).

---
## 0. Summary (plain English)
- **The plan works with Namecheap, but the monthly fee has to be about $2, not $1.** A .com costs us **$18.68 a year to renew**. That's $1.56/mo before any profit, so $1/mo loses money.
- **Namecheap only accepts connections from a fixed internet address,** and our site's servers don't have one. We'd need a tiny extra server (**$4/mo**) to pass requests through.
- **Namecheap needs $50 prepaid** before it turns on automatic buying. Every purchase comes out of that balance, so we keep it topped up.
- **Domains can't be moved to another company for 60 days after purchase,** and **purchases are almost never refundable** (5-day window at most). We charge first and buy right after. If the buy fails, the charge is cancelled at no cost.
- **The customer gets emails from Namecheap,** not just us. If they ignore the "verify your email" one for 15 days, their site goes offline.
- **We'd count as a "reseller"** under domain rules. That means a short disclosures page and a checkbox at checkout.
- **Cloudflare sells domains cheaper (at cost), but its terms bar buying services on behalf of others.** Its domain API is also a beta with no renewals. Not usable for this today.
- **My pick:** Namecheap, a short list of allowed endings (.com/.net/.org), ~$2/mo, built in 4 phases (~9–13 agent days, est.). "Bring your own domain" stays available.

## 1. The proposed plan (from Ezequiel, via Grok Bot)
- One-time setup fee, charged before we buy: Namecheap's live price + markup covers year one. After that the renewal is folded into the monthly plan (~$1–$2/mo), with auto-renew on.
- Registered in the customer's business name; transfers out always allowed. A customer who cancels can transfer away or pay yearly to stay. Reminders at 60 and 30 days; a failed card gets a grace period.

---
## 2. Caveats, with sources
**2.1 Getting API access (Namecheap)**
- **Requirement:** production API access needs one of these: ≥20 domains in the account, **≥$50 account balance**, or ≥$50 spent in the last 2 years ([API FAQ](https://www.namecheap.com/support/knowledgebase/article.aspx/9739/63/api-faq/)).
- **Sandbox:** a separate free account at sandbox.namecheap.com with no requirements. It uses the registry's test system, so test domains can't be deleted, and coupons don't work there (same FAQ; [API intro](https://www.namecheap.com/support/api/intro/)).
- **Allowlist:** you must allowlist at least one **IPv4** address before calls work (same pages).
- **Rate limits:** 50 calls/min, 700/hour, 8,000/day per key (FAQ). So the domain search box must cache and debounce.
- **Gaps:** there's **no API command for auto-renew, the transfer code or moving a domain between Namecheap accounts.** Those are dashboard-only ([methods list](https://www.namecheap.com/support/api/methods/)). The API does have `domains.renew`, `domains.dns.setCustom`/`setHosts`, `users.getPricing` and `users.getBalances`.

**2.2 Fixed IP vs. Cloudflare Workers**
- **The clash:** Workers have no fixed outbound IP (that's why the paid fixed-egress products below exist), and Namecheap needs an allowlisted one.
- **Option 1, small server (recommended):** a DigitalOcean droplet at **$4.00/mo** ([pricing](https://www.digitalocean.com/pricing/droplets)) plus a reserved IP, **free while attached** ([docs](https://docs.digitalocean.com/products/networking/reserved-ips/details/pricing/)). It runs a tiny relay that checks a shared secret; Worker → relay → Namecheap. Downside: one more server to patch, and a single point of failure.
- **Option 2, QuotaGuard Static:** from **$19/mo** with a *shared* static IP pair ([pricing](https://www.quotaguard.com/products/pricing)). Whether Workers' `fetch()` can use it is **unverified**, because Workers can't set an HTTP proxy.
- **Option 3, Cloudflare fixed egress:**
  - Dedicated CDN Egress IPs are **Enterprise-only** ([docs](https://developers.cloudflare.com/smart-shield/configuration/dedicated-egress-ips/setup/)).
  - Gateway dedicated egress IPs can now apply to Workers through a VPC Network binding ([changelog, Jun 5 2026](https://developers.cloudflare.com/changelog/post/2026-06-05-gateway-egress/)), but the IPs come via "contact your account team" ([docs](https://developers.cloudflare.com/cloudflare-one/traffic-policies/egress-policies/dedicated-egress-ips/)). **Price unverified.**

**2.3 Prepaid balance**
- "All billing operations through API can be performed using your Namecheap account balance only." You top it up by card, PayPal or crypto (FAQ).
- Auto-renew charges the balance first, then saved cards, starting **30 days before expiry** and retrying daily ([KB](https://www.namecheap.com/support/knowledgebase/article.aspx/10564/2207/can-i-set-up-automatic-billing-for-my-namecheap-services/)).
- `users.getBalances` reports "Funds Required for AutoRenew", so we can alert when the balance runs low.

**2.4 Prices, premium names and our rule**
- **Namecheap retail, Oct 4** (from the .com page's embedded price data; first-year prices are promos):

| Ending | 1st year | Renewal/yr |
|---|---:|---:|
| .com | $11.28 | **$18.48** |
| .net | $12.48 | $18.58 |
| .org | $8.48 | $18.98 |
| .us | $5.98 | $10.98 |
| .co | $7.98 | $45.48 |
| .io | $34.98 | $75.98 |
| .ai | $89.98 | $114.98 |
| .online | $0.98 | $35.68 |

  - Plus ICANN's **$0.20/yr** fee on gTLDs ([.com page](https://www.namecheap.com/domains/registration/gtld/com/)).
  - Whether API prices match these promo prices is **unverified**. `getPricing` returns `Price`/`RegularPrice`/`YourPrice` ([doc](https://www.namecheap.com/support/api/methods/users/get-pricing/)).
- **How premium names are flagged:**
  - `domains.check` returns `IsPremiumName` plus premium registration and renewal prices (their example: $13,000/yr) ([doc](https://www.namecheap.com/support/api/methods/domains/check/)).
  - `domains.create` needs `IsPremiumDomain` + `PremiumPrice` and errors if the flag is wrong (2515623) or prices don't match (2515610) ([doc](https://www.namecheap.com/support/api/methods/domains/create/)).
  - Premium domains are never refundable ([money-back](https://www.namecheap.com/support/knowledgebase/article.aspx/134/22/what-is-your-moneyback-policy/)).
- **Our rule:**
  - Sell **only .com, .net and .org**, and refuse anything with `IsPremiumName=true` or `EapFee>0`.
  - .us is cheap but **can't have WHOIS privacy** (2.9).
  - Excluded: .co, .io and .ai renew at $45–$115/yr, and the $0.98 promo endings (.online, .store, .shop) at ~$36–$49/yr.

**2.5 Renewal price changes**
- Namecheap may change prices at any time, effective at the next renewal ([registration agreement](https://www.namecheap.com/legal/domains/registration-agreement/)).
- **Verisign raises .com wholesale from $10.26 to $10.97 on Nov 1, 2026** ([Verisign Q1 2026 release](https://investor.verisign.com/static-files/fe73cf1b-c2fb-496e-91a9-52582845cffd)). How much Namecheap passes on is **unverified**.
- **Rule:**
  - A daily job reads `getPricing` RENEW.
  - The monthly domain fee must stay ≥ (renewal + ICANN fee) ÷ 12 + margin.
  - If it doesn't, we raise the fee with 30 days' notice (wording for Ezequiel to approve).
  - At $2/mo = $24/yr, .com's margin today is $5.32/yr before card fees.

**2.6 Refunds**
- **Namecheap:** new registrations and renewals *may* be refunded, at Namecheap's discretion, only for a valid reason within **5 days (120 hours)**. Some registries refuse even that ([refund policy](https://www.namecheap.com/legal/general/refund-policy/)).
- **ICANN:** the Add Grace Period is typically 5 days, and registries cap refunds for deletions in that window ([AGP Limits Policy](https://www.icann.org/en/contracted-parties/consensus-policies/add-grace-period-limits-policy/agp-add-grace-period-limits-policy-17-12-2008-en)).
- **After expiry (gTLDs):**
  - ~30 days to renew at the normal rate.
  - Then the domain may be auctioned, or enter a 30-day redemption period that costs a redemption fee.
  - Then 5 days pending delete; it's usually released 70–80 days after expiry ([KB](https://www.namecheap.com/support/knowledgebase/article.aspx/9916/2207/tlds-grace-periods/); [ERRP](https://www.icann.org/resources/pages/errp-2013-02-28-en)).
- **Our terms:** the setup fee is non-refundable once the domain is bought.

**2.7 Transfer locks**
- **60 days after registration:** under the current ICANN Transfer Policy a registrar may deny transfers within 60 days of creation or of a previous transfer (§3.7.5–3.7.6) ([policy](https://www.icann.org/en/contracted-parties/accredited-registrars/resources/domain-name-transfers/policy)). Namecheap enforces this ([KB](https://www.namecheap.com/support/knowledgebase/article.aspx/1346/219/canceled-domain-is-locked-at-current-registrar-or-is-not-yet-60-days/)).
- **After a registrant change:** the policy requires a 60-day lock unless the registrant opted out. Namecheap's agreement **opts everyone out** and acts as "Designated Agent" ([KB](https://www.namecheap.com/support/knowledgebase/article.aspx/9819/2209/new-icanns-interregistrar-transfer-policy/)). And because we register in the customer's name from day one, no registrant change is needed.
- **Possible future change:** a policy overhaul (30-day locks, no registrant-change lock) is reported. Adoption and effective date are **unverified**.
- **Customer-facing line:** "You can move your domain to another company starting 60 days after purchase."

**2.8 Registrant verification**
- Namecheap emails the **registrant** (the customer) from verification@namecheap.com. **If it isn't clicked within 15 days, the domain is suspended** and points to a notice page. Reminders go out 10 and 5 days before ([KB](https://www.namecheap.com/support/knowledgebase/article.aspx/9305/5/whois-verification-process/)).
- Required by ICANN's Whois Accuracy Program ([ICANN](https://www.icann.org/resources/pages/registration-data-accuracy-obligations-gdpr-2021-06-14-en)).
- **We show:** a "check your inbox" banner until verified. Use the customer's real, working business email.

**2.9 WHOIS privacy**
- Free "Withheld for Privacy", for life, on eligible endings. It's added via API with `AddFreeWhoisguard`/`WGEnabled` ([privacy](https://www.namecheap.com/security/domain-privacy-service/); create doc).
- **Not available** for .us, .ca, .uk, .de, .eu, .fr and others (same page).

**2.10 Who owns what, and leaving**
- **Ownership:** the registrant is the customer's business; the Namecheap account is ours.
- **Their transfer code:** the code to move the domain to another company is sent **to the registrant email** (the customer's), not ours ([KB](https://www.namecheap.com/support/knowledgebase/article.aspx/258/84/what-should-i-do-to-transfer-a-domain-from-namecheap/)). We can't hold it back over a payment dispute (Transfer Policy §5.4).
- **Push to their own Namecheap account:** free and near-instant, keeping DNS and auto-renew ([KB](https://www.namecheap.com/support/knowledgebase/article.aspx/1187/46/how-can-i-move-a-domain-from-one-namecheap-account-to-another/)). Whether a push works inside the 60-day lock is **unverified**.
- **Manual work:** there's no API for either path (2.1), so admin clicks it by hand.
- **The expiry gap:** Namecheap's own reminders (≈1 month and ≈1 week before, plus 1 after expiry) also go to the customer (ERRP §2.1). If we stop paying, the domain expires in the customer's name and they can still renew it themselves.

**2.11 Reseller duties**
- **We'd likely count as a "Reseller".** ICANN's definition is anyone in a registrar's distribution channel by agreement, or with its knowledge, who collects registrant data and submits it (RAA §1.26) ([2013 RAA](https://www.icann.org/en/contracted-parties/accredited-registrars/registrar-accreditation-agreement/2013-registrar-accreditation-agreement-08-06-2023-en)).
- **RAA §3.12:**
  - Don't claim ICANN accreditation or use its logo.
  - Pass through the registration-agreement terms.
  - Name the sponsoring registrar (Namecheap).
  - Link ICANN's registrant-education page and the Registrants' Benefits and Responsibilities.
- **ERRP §4.1.2/4.2.3:** show the renewal and redemption fees and how expiry notices are sent.
- **Namecheap's agreement:** when registering for someone else, we must be authorized to bind them and must tell them it's registered through Namecheap (registration agreement, "Registering a domain for a third party").
- **Unverified:** Namecheap's API terms page (`/legal/domains/api-terms-of-service/` returned "page not found"), and whether a separate written reseller agreement is needed.

**2.12 Stripe: charge before we buy**
- **Use authorize-then-capture:**
  1. A PaymentIntent with `capture_method: manual`.
  2. `domains.check` + price check.
  3. `domains.create`.
  4. **Capture** on success, **cancel** on failure.
- Online card holds last ~7 days, so capture well before `capture_before` ([Stripe](https://docs.stripe.com/payments/place-a-hold-on-a-payment-method)).
- Cancelling before capture costs nothing. A refund after capture doesn't return Stripe's fee ([Stripe refunds](https://docs.stripe.com/refunds)).
- **If `create` times out:** check `domains.getInfo`/`getList` before retrying, so we never buy twice.
- **If the Namecheap balance is short:** `create` fails, we cancel the hold, and admin gets an alert.
- Whether this fits our existing Checkout Session pattern (`payment_intent_data.capture_method`) is **unverified** this pass.

**2.13 DNS: pointing at Cloudflare**
- Either set Cloudflare's nameservers at purchase (`Nameservers` param, or `dns.setCustom`), or keep Namecheap DNS and write records with `dns.setHosts` ([methods](https://www.namecheap.com/support/api/methods/)).
- Custom nameservers turn off Namecheap's URL and email forwarding.
- Which fits depends on how customer sites are served (our zone vs. Cloudflare for SaaS custom hostnames). That isn't in this repo: **unverified**.
- If SaaS hostnames: 100 included, then **$0.10/mo each** ([Cloudflare](https://developers.cloudflare.com/cloudflare-for-platforms/cloudflare-for-saas/plans/)).

**2.14 Tax**
- Texas taxes data processing, 80% of the charge (20% exempt) ([Comptroller 96-259](https://comptroller.texas.gov/taxes/publications/96-259.php)). Its examples include "creating web (home) page and providing server space" ([94-127](https://comptroller.texas.gov/taxes/publications/94-127.php)).
- **Whether a domain registration fee is taxable in Texas: unverified.** I found no Texas ruling on it. Ask the CPA before launch.
- Bundling the domain into the monthly hosting fee may make it taxable along with hosting (**unverified**).

---
## 3. The three options
| | **A. Namecheap API (resell)** | **B. Cloudflare Registrar API** | **C. Customer buys; we connect** |
|---|---|---|---|
| Price to us | Retail (2.4) | At cost, no markup ([FAQ](https://developers.cloudflare.com/registrar/faq/)) | $0 |
| Automation | Full buy + renew; no API for auto-renew, push or transfer code | **Beta**: register only; *renewals, transfers and contact updates not in the API*; a subset of endings ([docs](https://developers.cloudflare.com/registrar/registrar-api/)) | Manual (today) |
| Can we do it for customers? | Yes, as a reseller (2.11) | Self-serve terms bar "sign[ing] up for the Services on behalf of a third party" ([self-serve terms](https://www.cloudflare.com/terms/)). Needs Cloudflare's written OK | n/a |
| Fixed IP needed | Yes (2.2) | No | No |
| Refunds | 5-day window, discretionary | **None, ever** (FAQ) | n/a |
| Limits | API rate limits | 500 domains/account; Cloudflare nameservers required (FAQ) | n/a |
| Leaving | Push or transfer code to the customer | Move to their Cloudflare account; 30-day lock ([docs](https://developers.cloudflare.com/registrar/account-options/inter-account-transfer/)) | Already theirs |
| Revenue | Setup markup + ~$2/mo | Same, if allowed | Setup fee only |

## 4. Recommendation: A, Namecheap API
1. **It's the only option that fits the plan today.** B's terms and beta gaps (no renewal API) block it, and C doesn't sell domains.
2. **Costs and risks are small and known.** A $4/mo relay, a $50 float, a short list of endings and no premium names keep the worst case to about one renewal (~$19) per bad debt.
3. **The customer stays the owner.** The transfer code and ICANN notices go to them, which matches "transfers out always allowed".
4. **Keep C as a visible choice ("I already have a domain").** The flow already exists (`DomainRequestForm.tsx`). The `NEED_DOMAIN_HELPER` copy changes (Sable).
5. **Revisit B** once Cloudflare ships renewal and transfer APIs and confirms in writing that platforms may register for customers.

## 5. Phased build (agent time, all **estimates**)
| Phase | What | Est. |
|---|---|---|
| 0. Setup (Ezequiel + Owen) | Namecheap + sandbox accounts, $50 balance, $4 relay with fixed IP, allowlist, secrets | 0.5 day + Ezequiel's clicks |
| 1. Buy (sandbox) | Search/check via relay with caching; allowed endings only, refuse premium; price display; Stripe hold → create → capture/cancel; `domains` + `domain_events` tables (RLS); privacy on; DNS to Cloudflare; admin view | 4–5 days |
| 2. Renew + remind | Monthly domain fee on the subscription; daily price check; our own `domains.renew` ~35 days out if in good standing; balance alert; 60/30-day emails; failed-card grace | 2–3 days |
| 3. Leave + legal | Cancel paths (push / transfer code / pay yearly) as admin tasks; "Domain terms" page + checkout checkbox (2.11); verification banner (2.8) | 1–2 days |
| QA | Vera, sandbox end to end, incl. failures (timeout, short balance, premium, failed card) | 1.5–2 days |
| **Total** | | **~9–13 days** |
- We renew through the API ourselves instead of Namecheap auto-renew, so renewal is in our control and logged. Auto-renew stays on as a backup only if the double-charge risk checks out (**unverified**).

## 6. Costs Ezequiel would pay
- **Namecheap account:** free. **$50 prepaid**, which is spent on domains, not a fee (FAQ).
- **Per domain:** Namecheap price + $0.20 ICANN fee. E.g. .com $11.28 first year (promo), $18.48/yr renewal (2.4).
- **Relay server:** $4.00/mo; reserved IP free while attached (2.2).
- **Stripe:** card fees on the setup fee and the added monthly amount (rate not re-checked). Refunds after capture lose the fee.
- **Possibly:** Cloudflare SaaS hostnames over 100 at $0.10/mo each; CPA time on tax.
- **Risk money:** non-refundable buys (typos, chargebacks) and renewals for customers who stop paying.

## 7. Couldn't verify
- Whether API prices equal the website promo prices.
- Namecheap's .com price after Nov 1.
- Whether a push works inside the 60-day lock.
- Namecheap's API terms and whether a written reseller agreement is needed.
- The new Transfer Policy's adoption and date.
- Texas tax treatment.
- QuotaGuard working from Workers; Cloudflare dedicated egress price.
- Stripe Checkout manual capture in our flow.
- How customer sites are served (DNS choice).
- Auto-renew + API renew interaction.
- The Stripe fee rate.

## 8. Questions for Ezequiel
1. Go with Namecheap (A), including being a "reseller" with a disclosures page?
2. Fund $50 now. What top-up buffer after that?
3. Endings: only .com/.net/.org? Add .us (cheap, no privacy)?
4. Monthly domain fee: **$2/mo** (.com renewal is $18.68/yr all-in, so $1 loses money)?
5. Setup-fee markup: how much over Namecheap's price?
6. Failed card near renewal: renew anyway (we risk ~$19) or let it lapse into Namecheap's ~30-day window (the customer can still renew)?
7. Leaving: default to a push to their own Namecheap account, with the transfer code on request?
8. OK to run one $4/mo server that Owen keeps patched?
9. Ask the CPA about Texas sales tax on the domain fees?
10. Should someone ask Cloudflare in writing whether registering for customers is allowed? I won't contact them without your OK.
