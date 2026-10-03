import type Stripe from 'stripe'
import { listLiveSubscriptions } from '@/lib/stripe/active-subscription'

/**
 * "Restart hosting" while the plan is canceled but still running ('ending'): undo the scheduled
 * cancellation on the customer's own subscriptions instead of selling a second plan. After this
 * Stripe reports the subscription as active and not set to end, so website access is 'active'.
 * Returns how many subscriptions were resumed. Throws if Stripe can't be reached. The caller holds the
 * change-plan lock (billing-actions.ts resumePlan, Aria Oct 3 4:05 PM).
 */
export async function resumeEndingSubscriptions(stripe: Stripe, customerId: string): Promise<number> {
  const live = await listLiveSubscriptions(customerId)
  let resumed = 0
  for (const sub of live) {
    if (sub.cancel_at_period_end !== true && sub.cancel_at == null) continue
    // Stripe returns BOTH cancel_at_period_end=true and cancel_at (the period end) after a cancel at
    // period end, and refuses an update that sends both fields ("Received both cancel_at_period_end and
    // cancel_at parameters", Vera 5b R1). Clear only cancel_at_period_end, which also clears cancel_at;
    // a cancel_at set on its own (no period-end flag) is cleared with cancel_at ''.
    await stripe.subscriptions.update(sub.id, sub.cancel_at_period_end === true ? { cancel_at_period_end: false } : { cancel_at: '' })
    resumed++
  }
  return resumed
}
