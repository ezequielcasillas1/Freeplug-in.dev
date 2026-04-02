# Service: Localhost-only admin

**Audience:** AI agents and engineers. **Not** shown on the live/production site.

## Visibility rule

- Admin UI is available **only in local development** (e.g. `localhost` / `127.0.0.1`, and/or explicit dev env such as `NODE_ENV=development` plus optional feature flag).
- **Production:** no admin routes in nav, routes return **404** or redirect; middleware blocks non-local hosts. Prefer **build-time** or **env** checks so admin bundles are not accidentally enabled in prod.

## Core: website transfer to customer

- Admin can **upload or attach website transfer materials per customer** (e.g. export packages, DNS/registrar handoff notes, API keys, credentials — follow your security policy; prefer one-time secure links over email for raw secrets when possible).
- Records are tied to **customer id** (and **project/site id** if you use one).
- **Audit trail:** who uploaded, timestamp, which customer/project.

## Additional admin capabilities (recommended)

- **Contract / milestone:** set or adjust **website value** target and rules for **which charges count** toward the milestone (refunds, partials).
- **Manual milestone:** mark website value complete or adjust progress after disputes/support (with reason in audit log).
- **Stripe read-only context:** show Stripe customer id, subscription ids, link out to Stripe Dashboard; do not duplicate payment logic in admin — use API/webhooks as source of truth.
- **Notifications:** resend or trigger test of “website value reached” (dev/staging only, or gated).

## Security

- Even on localhost, **do not commit real secrets**; use `.env` and local DB.
- Avoid **production customer impersonation** from this page unless product explicitly requires it and it is locked to dev only.

## Related

- Customer-facing progress and post-milestone hosting choice: `website-value-and-recurring-payments.md`.
