import type Stripe from 'stripe'
import { sendSubscriptionCancelledEmail } from '@/lib/email/send'
import { sendWebhookEmailOnce } from '@/lib/email/webhook-email-ledger'
import { formatBillingDate, stripeTimestampToDate, subscriptionPeriodEnd } from '@/lib/stripe/subscription-dates'

/**
 * Sends the "Your Freeplug hosting is canceled" email once per cancellation (cancel_at_period_end becomes
 * true, or cancel_at is set). Called from the Stripe webhook on customer.subscription.updated, which
 * Stripe sends after the in-app cancel (the billing portal's cancel is off since 4d02033).
 *
 * Two layers of "once" (round 6):
 *  - Per cancellation, across events: the subscription's Stripe metadata records which cancellation was
 *    emailed (CANCEL_EMAIL_MARKER_KEY = the cancellation's canceled_at/cancel_at) and by which event
 *    (CANCEL_EMAIL_EVENT_KEY). Another event for the same cancellation (e.g. the "updated" event our own
 *    metadata write causes) skips. Resuming and cancelling again is a new cancellation, so a new email.
 *  - Per event: the email_sends ledger (sendWebhookEmailOnce). A redelivery of the claiming event after
 *    Resend's 24 h idempotency window, or two deliveries at once, sends at most once; a failed send (or a
 *    claim stuck 'pending' for 15+ minutes after a crash) is re-claimed by Stripe's next retry.
 * The Resend idempotency key `<event.id>:subscription-cancelled` is kept as a third guard.
 */
export const CANCEL_EMAIL_MARKER_KEY = 'freeplug_cancel_email_sent_for'
/** The Stripe event that claimed the cancellation in CANCEL_EMAIL_MARKER_KEY. */
export const CANCEL_EMAIL_EVENT_KEY = 'freeplug_cancel_email_event'
/** Template name in the ledger and in the Resend idempotency key `<event.id>:<template>`. */
export const CANCEL_EMAIL_TEMPLATE = 'subscription-cancelled'

export type CancelNoticeResult =
  | 'sent'
  | 'not_set_to_cancel'
  | 'already_sent'
  | 'no_email'
  | 'send_failed'
  | 'claim_error'

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
  /** The Stripe event id: the ledger key and the Resend idempotency key `<eventId>:subscription-cancelled`. */
  eventId: string
): Promise<CancelNoticeResult> {
  if (!isSetToCancel(subscriptionFromEvent)) return 'not_set_to_cancel'

  // Re-read from Stripe: a retried event carries the old payload (without our marker), and the
  // customer may have resumed since.
  const sub = await stripe.subscriptions.retrieve(subscriptionFromEvent.id)
  if (!isSetToCancel(sub)) return 'not_set_to_cancel'
  const marker = cancellationMarker(sub)
  const metadata = sub.metadata ?? {}
  const ownedByThisEvent = metadata[CANCEL_EMAIL_MARKER_KEY] === marker && metadata[CANCEL_EMAIL_EVENT_KEY] === eventId
  // This cancellation was claimed by another event (or emailed before the ledger existed): never again.
  if (metadata[CANCEL_EMAIL_MARKER_KEY] === marker && !ownedByThisEvent) return 'already_sent'

  const customerId = typeof sub.customer === 'string' ? sub.customer : sub.customer.id
  const customer = await stripe.customers.retrieve(customerId)
  const email = 'deleted' in customer && customer.deleted ? null : (customer as Stripe.Customer).email
  if (!email) return 'no_email'

  const endDate = formatBillingDate(stripeTimestampToDate(sub.cancel_at) ?? subscriptionPeriodEnd(sub))
  const outcome = await sendWebhookEmailOnce(eventId, CANCEL_EMAIL_TEMPLATE, sub.id, async () => {
    // Claimed in the ledger: mark the cancellation as this event's before sending, so other events skip.
    if (!ownedByThisEvent) {
      await stripe.subscriptions.update(sub.id, {
        metadata: { [CANCEL_EMAIL_MARKER_KEY]: marker, [CANCEL_EMAIL_EVENT_KEY]: eventId },
      })
    }
    return sendSubscriptionCancelledEmail(email, { endDate }, { idempotencyKey: `${eventId}:${CANCEL_EMAIL_TEMPLATE}` })
  })
  return outcome === 'skipped' ? 'already_sent' : outcome
}
