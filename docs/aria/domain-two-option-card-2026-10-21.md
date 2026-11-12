# Build card: Freeplug two-option domain page (Aria, Oct 21, 2026, 2:23 PM CT)
CARD ONLY. Nothing gets built, merged or deployed, and no team work starts, until Cheke says go.

## Where it shows
The public domain page on freeplug-in.dev and the dashboard's domain results use one shared component.

## Search
- The server calls the Vultr relay with `namecheap.domains.check` (HMAC-signed, secret only on the server). It batches the searched name plus alternatives in one call, and the check takes a comma list.
- Hide any result where `IsPremiumName=true`.
- Show prices from `namecheap.users.getPricing`, cached about 6h.
- Turnstile plus a per-IP rate limit on the public page, so bots can't hammer the relay.
- Alternatives for taken names: the relay has no suggestion command, so we generate our own. Other TLDs (.com/.net/.co/.us), prefixes and suffixes (get-, -tx, the city), and hyphen variants. Check them all in the same batch and show only the available ones.

## Each available domain: two choices side by side
1. **Get it with Freeplug** (main button)
   - Stripe Checkout first. Our price is Namecheap cost plus a margin; Cheke sets the price.
   - The Stripe webhook marks the order paid. A server job then calls `namecheap.domains.create` through the relay, registered to Freeplug, with WHOIS privacy on.
   - The `domain_orders` table (service-role only) tracks status: pending_payment, paid, registering, registered or failed. It has a unique Stripe session id, a unique active order per domain name, and an idempotency key, so the create runs once.
   - If create fails after payment: retry once, then refund automatically in full and alert fplgn.dev.72@gmail.com. Before calling create, re-check that the domain is available and the price is unchanged. If it's taken or the cost went up, refund instead of registering.
   - Ownership is stored on the order: Freeplug holds it until buyout. After buyout the client picks between a transfer to their name and staying with Freeplug. If they cancel before buyout, Freeplug holds it until near the end of the paid year, then the client picks a free transfer or lets it expire. A reminder email goes out about 30 days before expiry.
   - No affiliate tracking on this path.
2. **Rather own it yourself? Buy at Namecheap** (smaller link)
   - A direct Impact tracking link with the domain pre-filled in the Namecheap search URL, marked `rel="sponsored noopener"`.
   - No cloaking: no redirect through our own domain, no link shortener, no hiding the target.
   - FTC note right beside it: "Freeplug may earn a commission if you buy through this link. It doesn't change your price." Sable polishes the wording.
   - We charge nothing and store nothing about the purchase.

## Never double-charge
- Path 2 never touches Stripe.
- Path 1 refuses to start if an active order exists for that domain. A second Checkout for the same domain shows "already in progress."
- The webhook and create are idempotent.

## Affiliate rules (Impact/Namecheap)
- No cloaking or redirects.
- No "Namecheap" in our ads, our domains, or paid search keywords.
- Commission is 20% on a new customer's first purchase, within the 30-day cookie window. We claim nothing else.

## Technical flags
- **Cloudflare Workers can't pin the relay's self-signed cert, and calling a bare IP from a Worker is unreliable.** Before building, the relay needs a hostname with a real certificate: a DNS record plus Let's Encrypt, or Cloudflare proxy plus an Origin cert. That needs Cheke's yes, since it's a DNS change.
- The relay HMAC secret is a Workers secret only. Never put it in the browser or logs, and the build scan checks `.next` for it.
- Decisions for Cheke:
  - Who pays renewals in year 2+. I'd suggest it's included while subscribed, at Freeplug's cost.
  - What happens to the domain if a payment is disputed.
  - The markup.

## Blockers
1. Relay registration is off (`RELAY_ALLOW_CREATE=0`). Turning it on needs Cheke's OK and a funded Namecheap balance.
2. Impact approval is pending, and we haven't applied yet. Until it's approved, path 2 is either hidden or a plain untracked Namecheap link (Cheke's call).
3. The relay hostname and cert, above.
4. The team hold.

## Effort and owners (rough judgment)
- Owen/Bob: about 3 days for search, Checkout, the order table, the register job, refunds and alerts.
- Lina: about 0.5 day for the two-option UI.
- Sable: the FTC note and button copy.
- Luma: about 1 day of QA in Stripe test mode and the Namecheap sandbox, covering the double-charge, refund and premium-hidden cases.
- Total about 4–5 days. Test mode on localhost first.
