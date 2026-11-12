# Freeplug outreach claim flow: architecture review of Owen's proposal (Aria, 2026-09-26)
Reviewed: /workspace/fp-mirror/outreach-claim-gap.md and Owen's six-point plan. Nothing was built, bought or changed.

## Verdict
Owen's plan is right on all six points and Stripe option (a). Build on it with the changes below. Two are real gaps against Vera's rules: #1 (the built site itself may be public) and #2 (a forwarded link lets a stranger claim).

## 1. GAP: the address can leak through the built site itself (Vera rule 5)
The preview page can hide everything, but if the finished site lives at a public 72 After staging URL, anyone who finds or guesses that URL sees the address, and search engines can index it. So:
- Staging copies of outreach sites must be noindex (X-Robots-Tag on the whole staging host) on a random, unguessable hostname or path, with no links to them from anywhere.
- Preferred for v1: show the site on the preview page as full-page screenshots stored in the private bucket, served by short-lived signed URLs only after the token check, plus an "open full preview" link that is also token-gated. No iframe needed, so no framing change on the 72 After host.
- If an iframe is required, the staging host must allow `frame-ancestors https://freeplug-in.dev` and still be noindex and unguessable. That is weaker, because the iframe src is visible in page source to anyone with the link.
- Decision for Ezequiel: screenshots (recommended) or iframe.

## 2. GAP: first claim wins, so a forwarded link lets a stranger claim
Anyone holding the link can create an account and claim. Controls:
- Publish is an admin action anyway, so Ezequiel verifies the claimer (the email or phone matches the business) before clicking Publish. Add that as a checklist line on the admin Publish screen.
- Add an admin "Unclaim / reissue link" action that clears claimed_by, revokes the old token and issues a new one.
- Require a confirmed email (`email_confirmed_at`) before the claim RPC runs. Google sign-in counts as confirmed.

## 3. Token (Vera rule 1): confirm Owen's plan, plus
- 32 random bytes from `crypto.randomBytes`, base64url (43 chars). Store only `sha256(token)` in `outreach_sites.token_hash` (unique). A plain SHA-256 is enough for a 256-bit random token; no HMAC or pepper needed.
- Look up by exact hash only. A one-character change gives a different hash, so it can't open another row.
- Every invalid state (unknown, expired, revoked, claimed) shows the same generic "This link has expired" page with no business name, and returns 404. No difference between states.
- Expiry: proposal is 30 days from sending (Ezequiel decides). Reissuing a link revokes the previous one. Claiming revokes it.
- Rate-limit token lookups per hashed IP (proposal: 30 per 10 minutes). Do NOT use the in-memory `hitLimit()`; it is per instance and fails on serverless. Build one shared Supabase table plus a SECURITY DEFINER `rate_check(bucket, key, limit, window)` function. The help-chat card needs the same thing (`chat_rate_check`), so build it once, generically.
- Optional hardening (recommended): `/p/<token>` is a route handler that checks the token, sets a short-lived signed httpOnly cookie (outreach site id, reuse the HMAC helpers in `src/lib/auth/reset-cookie.ts`), and 303-redirects to a clean `/preview`. That keeps the token out of the address bar, screenshots, history and later referrers. The emailed link keeps working until expiry.

## 4. Anonymous submits: confirm, with limits on the service-role code
- All service-role code for outreach lives in one `server-only` module (`src/lib/outreach/server.ts`). Every function takes the token (or the signed cookie), resolves the outreach site id itself, and never accepts a site id, user id or status from the client.
- Extend the ESLint `no-restricted-imports` rule on `@/lib/supabase/admin` so only that module (and admin code) may import it.
- Writes only insert into pending tables. No update or delete path for anonymous callers.
- Turnstile on every preview form (it needs the free Cloudflare account, which is already open item 3 on the help-chat card). Proposal: 5 submissions per hour per token, and 20 per day per hashed IP.
- Zod limits on every field, same as the request form.

## 5. Uploads (Vera rule 2): confirm the private bucket and content checks, plus
- Size limits hit before your own check does. A Next server action accepts only 1 MB by default (`serverActions.bodySizeLimit`), and Netlify functions accept roughly 6 MB per request (verify for this plan). So: resize in the browser to about 2,000 px JPEG before upload, one photo per request, and set a server limit of about 5 MB.
- On the server: check magic bytes (JPEG, PNG, WebP only; no SVG, no GIF), then decode and re-encode with `sharp`. Re-encoding rejects files that only look like images, strips EXIF (phone photos carry GPS location), and normalizes the format. Save under `outreach/<site_id>/<random>.jpg`, never the uploaded filename.
- Also set bucket-level `file_size_limit` and `allowed_mime_types` as a second layer, but don't rely on them (they trust the declared type).
- iPhone HEIC: the browser resize step outputs JPEG, which covers most cases. Test on a real iPhone.
- Proposed caps for Ezequiel: 20 photos per site, deleted 90 days after a "Not right now" or an expired, unclaimed link.

## 6. Pending details (Vera rule 4): confirm, plus
- `site_details_submissions` is append-only: each row has source (`preview`, `customer`, `admin`), fields jsonb, submitted_at, review status. Admin approval copies values into one `site_details` row.
- Rule 4 in the data: after claim the token is dead, so preview submissions stop. Also, approval refuses any preview submission older than `site_details.customer_confirmed_at`. Test both.
- The live site never reads these tables directly; the team applies approved changes.

## 7. Headers (Vera rule 5): confirm, with one correction
- For `/preview`, `/p/*` and `/claim`: `X-Robots-Tag: noindex, nofollow, noarchive`, `Referrer-Policy: no-referrer`, and `Cache-Control: private, no-store` (so Netlify's CDN never caches a business's preview). Set these in `next.config` `headers()` and also in page metadata.
- Correction to the gap doc: do NOT add the preview path to `robots.txt` Disallow. Google can still index a disallowed URL it finds linked elsewhere, and it never sees the noindex header because it can't crawl the page. The noindex header does the job. Keep it out of the sitemap.

## 8. Claim binding: confirm the service-role RPC, plus
- Carry the claim through signup with the signed cookie from section 3 (or `next=/claim`), not by putting the raw token into `emailRedirectTo`.
- `claim_outreach_site(p_site_id, p_user_id)`, EXECUTE granted to service_role only. One atomic `UPDATE ... WHERE claimed_by IS NULL AND revoked_at IS NULL AND expires_at > now() RETURNING`. It's idempotent when the same user calls it twice, and fails when a different user already claimed.
- In the same transaction: create the `website_requests` row with `source = 'outreach'` so `isPlansCheckoutAllowed` passes. Handle the existing `website_requests_one_open_per_user` index (if the user already has an open organic request, link to it instead of failing).
- Signed-in claimers: the middleware sends signed-in users away from `/signup`, so `/claim` must handle an existing session directly.

## 9. Stripe: agree with (a), setup-mode Checkout, subscription at publish
Why (a): no charge ever if the site never goes live, and no `trialing` status that `website-access.ts`, `active-subscription.ts` and `plans/priority.ts` would read as live.
Details to build:
- Setup-mode Checkout has no line items, so save the chosen plan (hosting tier and add-on) in the DB at setup time. At publish, recompute the price from `ADDON_TIERS` and the $35 to $100 clamp on the server. Never trust a stored amount from the client.
- The webhook currently treats `checkout.session.completed` as a subscription checkout. Branch on `session.mode`: for `setup`, save the customer id and the SetupIntent's payment method as the customer's default.
- Admin Publish creates the subscription off-session with `default_payment_method` and an idempotency key per outreach site. Set `published_at` and make the site live only once the first invoice is paid. If the card fails or needs 3D Secure, keep the site unpublished, show admin "card failed", and send the customer the hosted invoice or billing portal link.
- The one-plan-per-customer guard must also count "card saved, waiting for publish" so the customer can't start a second hosting checkout from `/dashboard/plans` meanwhile.
- Tracker mapping: "Hosting set up" means the card is saved; "Live" means `published_at` is set and the subscription is active.

## 10. Won't custom-build in v1
Domain purchase or DNS automation (manual request, admin handles it), in-preview chat, e-signature, automated outreach emails (copy-link only until Ezequiel approves sender, wording and opt-out), and any preview editing by the prospect.

## Tests to add to Vera's list
- A modified token, an expired token, a claimed token and a revoked token all return the same 404 page with no business name.
- A renamed .exe or .html as .jpg, an SVG, and a 20 MB file are all rejected. An uploaded photo has no EXIF GPS.
- A preview submission never changes `site_details` without admin approval, and can't be approved after the customer confirmed.
- A second user can't claim an already-claimed site. An unconfirmed email can't claim.
- The preview response carries noindex, no-referrer and no-store headers, and the staging URL is noindex.
- No charge at setup; subscription and first invoice only at Publish; a failed card leaves the site unpublished.
- Before patches, run the Arkitect structure check; before handoff, run its verify step (Ezequiel's standard).

## Decisions for Ezequiel
1. Screenshots or iframe for showing the site on the preview.
2. Link lifetime (proposal 30 days).
3. Photo caps (proposal 20 per site, about 5 MB after resize) and deletion after "Not right now" or expiry.
4. The phone number for "Call or text us", and whether texts are OK.
5. The free Cloudflare account for Turnstile (shared with the help chat).
