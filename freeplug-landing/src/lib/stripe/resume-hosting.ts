import type Stripe from 'stripe'
import { listLiveSubscriptions } from '@/lib/stripe/active-subscription'

/**
 * "Restart hosting" while the plan is canceled but still running ('ending'): undo the scheduled
 * cancellation on the customer's own subscriptions instead of selling a second plan. After this
 * Stripe reports the subscription as active and not set to end, so website access is 'active'.
 * Returns how many subscriptions were resumed. Throws if Stripe can't be reached.
 */
export async function resumeEndingSubscriptions(stripe: Stripe, customerId: string): Promise<number> {
  const live = await listLiveSubscriptions(customerId)
  let resumed = 0
  for (const sub of live) {
    if (sub.cancel_at_period_end !== true && sub.cancel_at == null) continue
    await stripe.subscriptions.update(sub.id, {
      cancel_at_period_end: false,
      ...(sub.cancel_at != null ? { cancel_at: '' as const } : {}),
    })
    resumed++
  }
  return resumed
}
