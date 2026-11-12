# Build card: consultation step (Aria, Oct 22, 2026, 8:00 PM CT)
Test mode only: a branch plus localhost on a non-3000 port, with Stripe in test mode. Nothing merges or goes live without Cheke's yes. Bob builds; Lina designs the UI from the existing dashboard style; Sable writes the copy; Luma does QA.

## Steps the client sees
1. Submits a website request (the short form, as today).
2. The dashboard shows "Next: your consultation" with two cards.
   - **A. Fill in the details**: a detailed form covering site type, the page count (shows the buyout tier live), the template choice, content and photos, the domain path (with Freeplug, or on their own with the 20% buyout discount), forms, booking or payments, the plan, the timeline, and notes. They can save and come back.
   - **B. Talk to us live**: pick phone, FaceTime, webcam or text, then book a slot through an embedded scheduler (Cal.com; no custom calendar). For phone or text they give a number and tick a consent box, which is logged with a timestamp per the standing consent rule.
3. Path B: after the session the team fills in the same checklist from the admin side, and the client gets "Review your summary".
4. Both paths: the client sees the summary and clicks **Looks good**, or "Change something", which goes back to edit.
5. "Looks good" sets the status to agreed, and only then can building, charges or a domain purchase start. An alert goes to the team inbox. Per Cheke's 7:45 PM routing, requests go to fplgn.dev.clients@gmail.com, but that's not deployed yet; for test mode it logs only.

## Data and state
- website_requests.status gains `consultation` and `agreed` (plus `building`). The flow is submitted, then in_review, then consultation, then agreed, then building, then closed.
- A new `consultations` table: request_id, path (form or live), live_method, booking_ref, checklist jsonb, prepared_by (client or team), agreed_at, agreed_ip, plus consent rows. RLS: the client reads and writes their own until agreed, then it's read-only. The team uses an admin RPC.
- A database trigger blocks moving to building unless agreed_at is set.

## Admin
A consultations queue in the admin, showing the path, the booked time and the checklist editor for live sessions.

## Not in scope
Video calling inside Freeplug (we use the client's own FaceTime or webcam app link); SMS sending (text means the team texts manually after consent, and SMS stays out of launch scope); reopening signups.

## Effort (rough judgment)
About 1.5–2 days for Bob, plus about 0.5 day for QA.
