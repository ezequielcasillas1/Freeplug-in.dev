import type Stripe from 'stripe'
import { sendSubscriptionCancelledEmail } from '@/lib/email/send'
import { formatBillingDate, stripeTimestampToDate, subscriptionPeriodEnd } from '@/lib/stripe/subscription-dates'

/**
 * Sends the "Your Freeplug hosting is canceled" email once when a subscription is set to cancel
 * (cancel_at_period_end becomes true, or cancel_at is set). Called from the Stripe webhook on
 * customer.subscription.updated, because cancelling happens in the Stripe billing portal.
 *
 * Idempotent without a schema change: the subscription's Stripe metadata records which
 * cancellation was emailed (CANCEL_EMAIL_MARKER_KEY = the cancellation's canceled_at/cancel_at).
 * Repeat webhook deliveries (and the metadata update's own "updated" event) see the marker and
 * skip. Resuming and cancelling again is a new cancellation, so it gets a new email.
 */
export const CANCEL_EMAIL_MARKER_KEY = 'freeplug_cancel_email_sent_for'
/** Template name in the Resend idempotency key `<event.id>:<template>`. */
export const CANCEL_EMAIL_TEMPLATE = 'subscription-cancelled'

export type CancelNoticeResult =
  | 'sent'
  | 'not_set_to_cancel'
  | 'already_sent'
  | 'no_email'
  | 'send_failed'

function isSetToCancel(sub: Stripe.Subscription): boolean {
  const live = ['active', 'trialing', 'past_due', 'unpaid'].includes(sub.status)
  return live && (sub.cancel_at_period_end === true || sub.cancel_at != null)
}

function cancellationMarker(sub: Stripe.Subscription): string {
  return String(sub.canceled_at ?? sub.cancel_at ?? 'set')
}

export async function sendCancelNoticeOnce(
  stripe: Stripe,
  subscriptionFromEvent: Stripe.Subscription,
  /** The Stripe event id: the send carries the Resend idempotency key `<eventId>:subscription-cancelled`. */
  eventId?: string
): Promise<CancelNoticeResult> {
  if (!isSetToCancel(subscriptionFromEvent)) return 'not_set_to_cancel'

  // Re-read from Stripe: a retried event carries the old payload (without our marker), and the
  // customer may have resumed since.
  const sub = await stripe.subscriptions.retrieve(subscriptionFromEvent.id)
  if (!isSetToCancel(sub)) return 'not_set_to_cancel'
  const marker = cancellationMarker(sub)
  if (sub.metadata?.[CANCEL_EMAIL_MARKER_KEY] === marker) return 'already_sent'

  const customerId = typeof sub.customer === 'string' ? sub.customer : sub.customer.id
  const customer = await stripe.customers.retrieve(customerId)
  const email = 'deleted' in customer && customer.deleted ? null : (customer as Stripe.Customer).email
  if (!email) return 'no_email'

  // Claim first so a concurrent retry can't send a second copy.
  await stripe.subscriptions.update(sub.id, {
    metadata: { [CANCEL_EMAIL_MARKER_KEY]: marker },
  })

  // The claim above is the committed write; the email comes after it and can never throw out of here.
  const endDate = formatBillingDate(stripeTimestampToDate(sub.cancel_at) ?? subscriptionPeriodEnd(sub))
  let result: Awaited<ReturnType<typeof sendSubscriptionCancelledEmail>>
  try {
    result = eventId
      ? await sendSubscriptionCancelledEmail(email, { endDate }, { idempotencyKey: `${eventId}:${CANCEL_EMAIL_TEMPLATE}` })
      : await sendSubscriptionCancelledEmail(email, { endDate })
  } catch (e) {
    result = { success: false, reason: 'local_error', error: e instanceof Error ? e.message : 'Unknown error' }
  }
  if (!result.success) {
    console.error('[cancel-notice] send failed', sub.id, result.error)
    return 'send_failed'
  }
  return 'sent'
}
