# Freeplug: help-chat change requests sent to Ezequiel for approval (Aria, Sun Oct 4 2026, 2:45 PM CT)
Ezequiel asked for this through Grok Bot: every new help-chat change request goes to his Grok Bot routine for approve/decline.

## Today (9c8bbfc)
`sendHelpChangeRequest` (dashboard/request-website/actions.ts:195) appends a text block to `website_requests.notes`. There's no table, no status, and no notification.

## Build (Owen, on top of the add-ons head, own branch, local only)
1. **Migration `change_requests`:**
   - Columns: id uuid pk, user_id default auth.uid(), website_request_id fk, change_type, page ≤200, description ≤2000, photo_name null, plan_step text, billing text check in ('included','paid_addon','quote','unknown'), status text default 'pending_review' check in ('pending_review','approved','declined'), decision_note ≤500 null, decided_at null, notified_at null, notify_error text null, created_at, updated_at.
   - RLS: select own, insert own (with check: status = 'pending_review' and the decision fields null), no client update or delete. Admin/service role changes status.
2. **sendHelpChangeRequest:** keep today's notes append, so /admin still works, AND insert the row. The customer's submit succeeds even if the webhook fails.
3. **Webhook (best effort, server only):** send it after the response using `after()` (waitUntil on Cloudflare), with a 5s timeout and one try. On success set notified_at, on failure set notify_error. Add a "Resend to Ezequiel" button in /admin. Skip it silently and log it if the env vars are unset.
   - Env (server only, never NEXT_PUBLIC_): `CHANGE_APPROVAL_WEBHOOK_URL` and `CHANGE_APPROVAL_WEBHOOK_KEY`.
   - Auth header: the format Grok Bot's routine expects (Grok Bot confirms it). Default `Authorization: Bearer <key>`.
   - Payload v1 (no email, phone, user id, Stripe id or IP):
     ```json
     {"v":1,"event":"change_request.created","request_id":"<uuid>","business_name":"...","change_type":"...","page":"...",
      "description":"<scrubbed>","has_photo":true,"plan_step":"starter","billing":"included|paid_addon|quote|unknown",
      "created_at":"<ISO>","admin_url":"<site>/admin/change-requests/<uuid>"}
     ```
   - Scrub the description before sending: emails, phone-number patterns and 13–19-digit runs become "[removed]". The stored row keeps the original.
   - billing: `included` = the plan or an active add-on still has a use left this period. `paid_addon` = no use left, so the customer would need the $5 or $5.75 add-on. `quote` = over an hour (maintenance $50–$100, quote first). `unknown` = can't tell.
   - request_id doubles as the idempotency key.
4. **Decision:** Ezequiel decides in Grok Bot, Grok Bot passes it to Jace, and Owen or the team marks it in /admin with Approve or Decline + an optional note (admin only, service role). Approve doesn't charge anything or start work automatically.
5. **Customer side:** the dashboard shows the status (Waiting for review / Approved / Declined + note). No email for now. Sable writes the copy in English + Spanish.
6. **Tests:**
   - The submit succeeds with the webhook down, slow, or returning 500.
   - The payload has no email, phone, user id or Stripe id, and scrubbing works.
   - A client can't insert a row as approved or update one.
   - The key never appears in the client bundle (bundle grep).
   - The admin decision works.
   - Arkitect structure check before patches, verify_codebase on arkitect-clean before handoff.
7. **Order:** Vera QA, then my go, then :3000 for Ezequiel's review. Nothing goes live without his yes.
