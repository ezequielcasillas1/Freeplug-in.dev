import type Stripe from 'stripe'
import { sendAddonRefundedEmail } from '@/lib/email/send'
import { sendWebhookEmailOnce } from '@/lib/email/webhook-email-ledger'
import { addonRefundOf } from '@/lib/stripe/addon-refund-info'
import { addonNameList, addonRefundNote, addonTurnedOffRefundEmailSubject } from '@/lib/plans/ladder-copy'

/** Template name in the email_sends ledger and in the Resend idempotency key. */
export const ADDON_REFUND_EMAIL_TEMPLATE = 'addon-refunded'
/** Ledger key: once per refunded invoice, whichever path refunded it (request or invoice.paid self-heal). */
export const addonRefundEmailKey = (invoiceId: string) => `addon-refund:${invoiceId}`

export type AddonRefundNoticeResult = 'sent' | 'not_refunded' | 'no_email' | 'already_sent' | 'send_failed' | 'claim_error'

/**
 * Aria, Oct 4 9:27: tell the customer in plain words why an add-on charge was refunded (the reason and
 * where the money went, from the invoice's refund metadata), through the same webhook email path as the
 * cancel notice: the email_sends ledger (sendWebhookEmailOnce) keyed by the invoice, so a Stripe
 * redelivery, the request and the webhook both refunding, or two deliveries at once send it once.
 * Reads the invoice fresh. Never throws for a missing email; a Stripe read error throws (the caller logs).
 */
export async function sendAddonRefundNoticeOnce(stripe: Pick<Stripe, 'invoices' | 'customers'>, invoiceId: string): Promise<AddonRefundNoticeResult> {
  const inv = await stripe.invoices.retrieve(invoiceId)
  const refund = addonRefundOf(inv as Parameters<typeof addonRefundOf>[0])
  if (!refund) return 'not_refunded'
  const customerId = typeof inv.customer === 'string' ? inv.customer : inv.customer?.id
  if (!customerId) return 'no_email'
  const customer = await stripe.customers.retrieve(customerId)
  const live = 'deleted' in customer && customer.deleted ? null : (customer as Stripe.Customer)
  const email = live?.email ?? null
  if (!email) return 'no_email'
  // Vera L-2 / Sable: "Hi {userName}," with the customer's name on file; "Hi," only when there is none.
  const userName = live?.name?.trim() || undefined
  const name = addonNameList(refund.addons)
  const note = addonRefundNote(name, refund.reason, refund.cardCents, refund.creditCents, refund.carriedCents ?? 0)
  // Sable 10:01: the L-1 self-heal refund (a turned-off add-on still billed) has its own subject.
  const subject = refund.kind === 'turned_off' ? addonTurnedOffRefundEmailSubject(name) : undefined
  const key = addonRefundEmailKey(invoiceId)
  const outcome = await sendWebhookEmailOnce(key, ADDON_REFUND_EMAIL_TEMPLATE, invoiceId, () =>
    sendAddonRefundedEmail(email, { ...(userName ? { userName } : {}), addonName: name, note, ...(subject ? { subject } : {}) }, { idempotencyKey: `${key}:${ADDON_REFUND_EMAIL_TEMPLATE}` })
  )
  return outcome === 'skipped' ? 'already_sent' : outcome
}
