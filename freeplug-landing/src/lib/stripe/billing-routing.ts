import type Stripe from 'stripe'
import { isLiveSubscriptionStatus } from './subscription-status'
import { billingPortalSessionParams } from './portal'
import { stripeLocaleParam } from './locale'
import { DEFAULT_LOCALE, type AppLocale } from '@/i18n/config'
import { invoiceTipCents } from '../plans/tips'
import { hasPendingSwitch } from './change-plan'
import { addonRefundOf } from './addon-refund-info'
import { REMOVAL_OWED_BOX_ID } from '../plans/removal-owed-box'

export { REMOVAL_OWED_BOX_ID }

type AddonRefundInfo = NonNullable<ReturnType<typeof addonRefundOf>>

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
 * Since Aria's 4:05 PM ruling every portal session (Manage billing too) is that card-only flow on the
 * dedicated configuration (portal.ts).
 */

/** Where Manage billing goes while a plan switch is planned. */
export const PLANS_PENDING_BILLING_PATH = '/dashboard/plans?billing=pending'
/** Where the card-update flow returns (also its after-completion redirect). */
export const PLANS_CARD_RETURN_PATH = '/dashboard/plans?card=updated'
/** Where a failed "Resume plan" lands: the dashboard shows RESUME_FAILED_MESSAGE (support contact). Never the portal. */
export const RESUME_FAILED_PATH = '/dashboard?hosting=resume_failed'
/** "Resume plan" worked (or a fresh read shows the plan is no longer set to end: a double click / second tab, Vera B1). */
export const RESUMED_PATH = '/dashboard?hosting=resumed'
/**
 * Aria 10:09 (option A): Resume worked, but an add-on removal is still owed: the Plans page shows the
 * amber status box at the top of the Plans card. A second Resume click lands on the same box, scrolled
 * into view and focused (Lina).
 */
export const RESUMED_REMOVAL_OWED_PATH = '/dashboard/plans?hosting=resumed'
export const RESUMED_REMOVAL_OWED_FOCUS_PATH = `/dashboard/plans?hosting=resumed&focus=${REMOVAL_OWED_BOX_ID}#${REMOVAL_OWED_BOX_ID}`
/** "Resume plan" while the change-plan lock is held and the plan is still set to end: RESUME_BUSY_MESSAGE (Vera B2). */
export const RESUME_BUSY_PATH = '/dashboard?hosting=resume_busy'

/**
 * The customer's live subscription with a plan switch AHEAD, if any. "Pending" means only that a
 * schedule phase starts in the future (Aria, Oct 3 3:43 PM): a schedule whose switch phase is already
 * current is released here (lazily), so Manage billing goes back to the portal right at the switch.
 */
export async function findScheduledSubscription(
  stripe: Stripe,
  customerId: string,
  now: Date = new Date()
): Promise<{ subscriptionId: string; scheduleId: string } | null> {
  const res = await stripe.subscriptions.list({ customer: customerId, status: 'all', limit: 100 })
  for (const s of res.data) {
    if (!isLiveSubscriptionStatus(s.status) || !s.schedule) continue
    if (!(await hasPendingSwitch(stripe, s, now))) continue
    return { subscriptionId: s.id, scheduleId: typeof s.schedule === 'string' ? s.schedule : s.schedule.id }
  }
  return null
}

/**
 * Portal session params for the card-only flow (Manage billing and Update card). Same as
 * billingPortalSessionParams (portal.ts): the dedicated configuration plus a payment_method_update
 * flow; throws PortalNotConfiguredError without STRIPE_PORTAL_CONFIGURATION_ID.
 */
export function paymentMethodUpdateSessionParams(
  customer: string,
  returnUrl: string,
  env: Record<string, string | undefined> = process.env,
  locale: AppLocale = DEFAULT_LOCALE
): Stripe.BillingPortal.SessionCreateParams {
  // Card R7: the portal opens in profiles.locale (no `locale` key at all with the gate off).
  return { ...billingPortalSessionParams(customer, returnUrl, env), ...stripeLocaleParam(locale, env.NEXT_PUBLIC_FREEPLUG_I18N_ES) }
}

export type InvoiceRow = {
  id: string
  number: string | null
  created: string
  totalCents: number
  /** The tipping system: the tip part of this invoice (its tip lines; 0 when none or a credit). */
  tipCents: number
  currency: string
  status: 'paid' | 'open' | 'uncollectible'
  hostedUrl: string | null
  pdfUrl: string | null
  /** Aria, Oct 4 9:27: an add-on charge the self-heal refunded (the Plans page explains why). */
  addonRefund?: AddonRefundInfo | null
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
      // Invoices from invoices.list carry their first lines (ours have at most a few), so the tip
      // part is read from the tip price lines without another request.
      tipCents: Math.min(invoiceTipCents(inv as Parameters<typeof invoiceTipCents>[0]), Math.max(inv.total, 0)),
      currency: inv.currency,
      status: inv.status,
      hostedUrl: inv.hosted_invoice_url ?? null,
      pdfUrl: inv.invoice_pdf ?? null,
      addonRefund: addonRefundOf(inv as Parameters<typeof addonRefundOf>[0]),
    })
  }
  return rows
}
