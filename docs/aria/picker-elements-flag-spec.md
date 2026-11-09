# Spec: Elements-only picker + customer-pays ThemeForest option
Owner: Owen (build later). Author: Aria Voss, Oct 14, 2026. Spec only: no code, purchases, or Arkitect until Sat Oct 17. Cheke's decision: Freeplug/Cheke never pays for ThemeForest-only licenses.

## 1. "On Elements" flag (set by Lina, manually)
- No public Elements catalog API, so it's set by hand.
- D1 `envato_items` gets new columns: `on_elements` (INTEGER 0/1, NULL = not reviewed), `elements_url` (TEXT, must match ^https://elements\.envato\.com/), `elements_checked_by`, `elements_checked_at`.
- The catalog sync never overwrites these columns; changed-rows-only hashing excludes them.
- Admin page (:3000, localhost-only plus ADMIN_EMAILS): a per-item toggle with a required Elements URL when it's set to yes. Writes an audit row (who, item, old→new, time). Filters: unreviewed / on / off.
- Customer picker (envato_catalog choice): shows only `on_elements = 1` items for the request's business_type.
- Fallback: if a type has fewer than 6 flagged items, fill up to 6 with flagged items tagged general local-business. Fallback cards get a small "general template" note. Unreviewed and off items are never shown in the catalog list.
- Server-side check: the pick server action rejects an envato_item_id that isn't `on_elements = 1` at pick time. A later unflag doesn't change existing picks, but the admin sees a warning.

## 2. Customer-pays ThemeForest option
- New template_choice value: `client_purchase` (alongside envato_catalog, client_pasted, team_pick). Applies to ThemeForest-only items (`on_elements = 0`) the team offers, plus pasted ThemeForest links.
- The UI shows a separate section, "Premium templates (you buy the license)", with the ThemeForest price shown as Regular (from the item-prices data, labeled "price set by Envato, may change"). It states clearly that the customer buys it on ThemeForest in their own name, Freeplug doesn't pay or reimburse, and the license belongs to the customer.
- Required checkbox: "I'll buy the Regular license myself in my name." It's stored with a timestamp.
- New nullable website_requests columns: `client_license_ack_at` (timestamptz), `purchase_code` (text, UUID-format CHECK), `purchase_code_verified_at` (timestamptz), `purchase_code_verified_by`.
- Purchase code entry: the customer pastes it in the dashboard. A server action verifies it through Envato's author sale lookup only if our token has that scope; otherwise the admin verifies it by hand on the admin page. The code is never shown back in full (last 4 only) and never logged.
- Build gate: the team won't start on a client_purchase request until purchase_code_verified_at is set. Admin page shows the status.
- Consistency CHECK: client_purchase requires client_license_ack_at; envato_item_id or pasted_template_url is set.
- The existing client_pasted path follows the same rules: the customer buys it and we record the code. This closes the card's open "who pays" question: always the customer.
- The 65-minute change window and admin lock/unlock apply unchanged. Switching away after a code is verified is the customer's loss (no refund from us); the copy says so.

## Tests (Vera)
Only flagged items are listed; the fallback fills to 6; an unflagged id is rejected by the server; the sync preserves flags; the flag audit row is written; client_purchase without ack is rejected; a bad purchase code format is rejected; the code is masked in UI and logs; the build gate blocks until verified; the window/lock still enforce.

## Out of scope
Any purchase by Freeplug, an Elements scraping bot, reimbursement flows, live deploy.
