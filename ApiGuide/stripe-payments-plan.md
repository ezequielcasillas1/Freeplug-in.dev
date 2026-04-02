# Stripe payments plan — hosting, add-ons, maintenance

## Goals

| Flow | Amount | Stripe shape |
|------|--------|--------------|
| Hosting (recurring) | **$20–$50/mo** (default **$20**) | Subscription with one recurring price whose amount is set at checkout (validated server-side). |
| Optional add-on | **+$5/mo** | Second subscription item (separate Price) on the same subscription — **supported**; no need for a separate “plan” unless you want it for reporting only. |
| Maintenance (pay-as-you-go) | **$50–$100** per request, **unlimited** times/year | One-time Checkout (`mode: payment`) or Payment Link / Invoice per request — **not** a subscription. |

---

## 1. Hosting: custom $20–$50 (default $20)

**Recommended:** [Stripe Checkout](https://docs.stripe.com/payments/checkout) Session, `mode: subscription`, with **dynamic** recurring `price_data` (or a small set of Prices if you prefer fixed tiers).

- **Server:** Accept only amounts in **cents** between `2000` and `5000`; default UI = `$20.00`.
- **Product:** One “Hosting” product; one recurring line item whose `unit_amount` = chosen monthly amount.
- **Why not client-only amount:** Never trust the browser — validate range on the API that creates the Checkout Session.

**Alternatives (if you outgrow dynamic prices):** Multiple Prices ($20, $25, …, $50) on one Product; customer picks tier — simpler reporting, less flexible.

---

## 2. Add-ons: +$5 with hosting

**Feasible in Stripe:** Yes. Model the add-on as a **second recurring Price** (e.g. product “Add-on”) and add it as a **second line item** on the same subscription.

- At signup: Checkout Session with 1–2 subscription line items (hosting + optional add-on).
- Later toggling add-on on/off: [Subscription Items API](https://docs.stripe.com/api/subscription_items) — add/remove the $5 Price on the existing subscription (with proration rules you define).

**Separate “payment plan” only if:** You want add-on as a **one-time** charge only, or a totally separate subscription — usually unnecessary for a flat +$5/mo add-on.

---

## 3. Maintenance: $50–$100, repeatable one-time payments

**Model:** Each maintenance request = **one-time payment**, not a subscription.

- **Checkout Session** `mode: payment` with `price_data` (amount from **$50–$100** validated server-side), or fixed Prices per band if you prefer.
- **“Endless” times:** No Stripe cap — same customer can complete many Checkout sessions; you track scope/approvals in your app.
- **Optional:** [Customer Portal](https://docs.stripe.com/customer-management) for payment methods; [Invoices](https://docs.stripe.com/invoicing) if you send “pay this invoice” instead of Checkout for some requests.

**Distinction:** Hosting + optional $5 add-on = **Billing / subscriptions**. Maintenance = **Payments / one-time** — keeps pricing and accounting clear.

---

## 4. Implementation order

1. Stripe Dashboard: Products/Prices strategy (hosting Product; add-on Product at $5/mo; maintenance Product or dynamic one-time amounts).
2. Backend: endpoint to create Checkout Sessions (hosting subscription; maintenance one-time) with **amount validation** and [webhooks](https://docs.stripe.com/webhooks) (`checkout.session.completed`, `customer.subscription.*`, `invoice.paid`).
3. Frontend: amount picker $20–$50 (default $20); checkbox for +$5 add-on; separate CTA for maintenance $50–$100.
4. Go-live: [Stripe Go Live checklist](https://docs.stripe.com/get-started/checklist/go-live), test mode, then live keys.

---

## 5. API / SDK notes

- Prefer **Checkout Sessions** + **Billing** for subscriptions; avoid legacy Charges API.
- Use a current API version (e.g. **2026-01-28.clover** or your project’s pinned version) consistently in Dashboard and code.

---

## 6. Open decisions (product)

- **Proration** when users add/remove the $5 add-on mid-cycle.
- **Tax** (Stripe Tax vs manual).
- Whether maintenance is **always** Checkout or sometimes **invoice** after you quote scope.

---

## 7. Implementation (freeplug-landing)

- **Env:** copy `.env.example` → `.env.local` with `STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET`, `NEXT_PUBLIC_APP_URL`.
- **Local webhooks:** `stripe listen --forward-to localhost:3000/api/webhooks/stripe`
- **UI:** `#hosting-plans` section + **Plans** nav link; routes under `/api/checkout/*` and `/api/webhooks/stripe`.
