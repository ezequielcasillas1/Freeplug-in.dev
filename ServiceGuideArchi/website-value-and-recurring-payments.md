# Service: Website value milestone + unlimited recurring payments

**Audience:** AI agents and engineers implementing the agency billing and customer dashboard.

## Business rules

- **Website value** is a fixed target (example: **$1,000**). It is a **milestone**, not the end of billing.
- **Recurring charges do not stop** when the customer reaches that amount. The same subscription (e.g. $20/month) **continues indefinitely** until the customer **cancels** in Stripe or your app.
- **Customer responsibility:** They must understand that after “website value” is reached, **payments keep going** unless they cancel. Copy and UI must state this clearly (no implied auto-stop at $1,000).

## What “reached website value” means

- When **cumulative successful payments** toward the build (or the single combined line item you define) **≥ website value** (e.g. $1,000), the account is marked **website value complete**.
- After that milestone, the customer may:
  - **Transfer** the site to a **preferred hosting plan** (your flow: DNS, export, or new Stripe products), and/or
  - **Continue** current **hosting and maintenance** plans (same or updated subscriptions).

## Dashboard (required)

1. **Progress to website value**
   - Show **amount paid to date** vs **target** (e.g. $740 / $1,000).
   - Optionally show **payment count** (e.g. 37 of ~50 at $20/mo) if all payments apply equally; derive from your ledger or Stripe invoice history.

2. **Milestone state**
   - Before complete: normal “in progress” state.
   - After complete: clear badge or section: **“Website value reached.”**

3. **Post-milestone actions (informational + CTAs)**
   - Explain that **billing continues** until they cancel.
   - Offer paths: **switch to preferred hosting plan** (link or wizard) vs **keep hosting and maintenance** (link to plan management or Stripe Customer Portal where appropriate).

## Notifications

- When cumulative paid **crosses** website value: **one-time notification** (in-app and/or email) that they have **reached website value** and may **transfer hosting** or **continue** current plans — with the same **payments continue** disclaimer.

## Implementation notes (Stripe)

- Model as **ongoing subscription(s)**; do **not** rely on Stripe to “turn off” at $1,000.
- **Track cumulative amount** in your backend (sum successful invoice/charge amounts you attribute to “website value” line items), or reconcile periodically via Stripe API. Use that for progress and milestone flags.
- **Customer Portal** can handle cancel/update payment method; **your dashboard** owns progress bars, milestone copy, and hosting-transfer UX.

## Edge cases to handle in spec

- Partial payments, failed retries, refunds, or plan changes: define which amounts **count** toward website value and update progress accordingly.
- If website value or monthly price changes mid-relationship: define whether the milestone is **locked at sale** or recalculated (prefer **locked contract** for clarity).

## Admin (localhost only)

- **Not on the live site.** Local dev admin can upload **website transfer keys/materials** to the customer record and support milestone overrides; see `localhost-admin.md`.
