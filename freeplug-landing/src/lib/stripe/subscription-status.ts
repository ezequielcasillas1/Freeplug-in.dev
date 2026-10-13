import type Stripe from 'stripe'

/**
 * Subscription statuses that still count as "has a hosting plan" for checkout: the customer is
 * (or will be) billed, so a second plan must not be sold. 'incomplete' is excluded on purpose:
 * it is a first payment that never went through and expires on its own within 23 hours.
 */
export const LIVE_SUBSCRIPTION_STATUSES: ReadonlyArray<Stripe.Subscription.Status> = [
  'active',
  'trialing',
  'past_due',
  'unpaid',
]

export function isLiveSubscriptionStatus(status: string): boolean {
  return (LIVE_SUBSCRIPTION_STATUSES as ReadonlyArray<string>).includes(status)
}
