import type Stripe from 'stripe'
import { isLiveSubscriptionStatus } from './active-subscription'
import { billingPortalSessionParams } from './portal'

/**
 * Billing while a plan switch is planned (Aria, Oct 3 12:56).
 *
 * A downgrade waits in a Stripe subscription schedule. While one exists, every "Manage billing" /
 * portal link goes to the in-app Plans page (which shows the pending change and its date) instead of
 * the Billing Portal, whose cancel screen we never verified against a schedule-managed subscription.
 * Card updates use a portal session with flow_data.type = payment_method_update: Stripe hides the
 * portal's navigation in a flow and, with after_completion = redirect, sends the customer straight
 * back, so the session can only change the card. Invoices are listed IN THE APP (Stripe's hosted
 * invoice page and PDF links), not through the portal: no portal flow is invoice-only.
 */

/** Where Manage billing goes while a plan switch is planned. */
export const PLANS_PENDING_BILLING_PATH = '/dashboard/plans?billing=pending'
/** Where the card-update flow returns (also its after-completion redirect). */
export const PLANS_CARD_RETURN_PATH = '/dashboard/plans?card=updated'

/** The customer's live subscription that a schedule manages (a planned switch), if any. */
export async function findScheduledSubscription(
  stripe: Pick<Stripe, 'subscriptions'>,
  customerId: string
): Promise<{ subscriptionId: string; scheduleId: string } | null> {
  const res = await stripe.subscriptions.list({ customer: customerId, status: 'all', limit: 100 })
  for (const s of res.data) {
    if (!isLiveSubscriptionStatus(s.status) || !s.schedule) continue
    return { subscriptionId: s.id, scheduleId: typeof s.schedule === 'string' ? s.schedule : s.schedule.id }
  }
  return null
}

/** Portal session params for the card-only flow (works with or without a schedule). */
export function paymentMethodUpdateSessionParams(
  customer: string,
  returnUrl: string,
  env: Record<string, string | undefined> = process.env
): Stripe.BillingPortal.SessionCreateParams {
  return {
    ...billingPortalSessionParams(customer, returnUrl, env),
    flow_data: {
      type: 'payment_method_update',
      after_completion: { type: 'redirect', redirect: { return_url: returnUrl } },
    },
  }
}

export type InvoiceRow = {
  id: string
  number: string | null
  created: string
  totalCents: number
  currency: string
  status: 'paid' | 'open' | 'uncollectible'
  hostedUrl: string | null
  pdfUrl: string | null
}

/**
 * The customer's invoices for the in-app list, newest first. Drafts (not sent yet) and voided ones
 * (for example the proration invoice of a declined upgrade, voided by change-plan.ts) are left out.
 */
export async function listInvoicesForCustomer(
  stripe: Pick<Stripe, 'invoices'>,
  customerId: string,
  limit = 12
): Promise<InvoiceRow[]> {
  const res = await stripe.invoices.list({ customer: customerId, limit: Math.min(Math.max(limit, 1), 100) })
  const rows: InvoiceRow[] = []
  for (const inv of res.data) {
    if (inv.status !== 'paid' && inv.status !== 'open' && inv.status !== 'uncollectible') continue
    if (!inv.id) continue
    rows.push({
      id: inv.id,
      number: inv.number ?? null,
      created: new Date(inv.created * 1000).toISOString(),
      totalCents: inv.total,
      currency: inv.currency,
      status: inv.status,
      hostedUrl: inv.hosted_invoice_url ?? null,
      pdfUrl: inv.invoice_pdf ?? null,
    })
  }
  return rows
}
