import type Stripe from 'stripe'
import { listLiveSubscriptions } from '@/lib/stripe/active-subscription'
import { resumeSubscription, type ResumeOptions } from '@/lib/stripe/change-plan'

/**
 * "Restart hosting" while the plan is canceled but still running ('ending'): undo the scheduled
 * cancellation on the customer's own subscriptions instead of selling a second plan. After this
 * Stripe reports the subscription as active and not set to end, so website access is 'active'.
 * Returns how many subscriptions were resumed. Throws if Stripe can't be reached. The caller holds the
 * change-plan lock (billing-actions.ts resumePlan, Aria Oct 3 4:05 PM).
 */
export async function resumeEndingSubscriptions(stripe: Stripe, customerId: string, now: Date = new Date(), opts: ResumeOptions = {}): Promise<number> {
  const live = await listLiveSubscriptions(customerId)
  let resumed = 0
  for (const sub of live) {
    // Clears the scheduled cancellation (only cancel_at_period_end, or cancel_at '' on its own: Vera 5b
    // R1) and puts back an add-on removal the cancel dropped (Vera M-1, Aria Oct 4 9:28). If it can't be
    // put back, the plan stays on and the removal is owed (Aria 10:09, option A; opts.onRemovalOwed).
    if ((await resumeSubscription(stripe, sub as Parameters<typeof resumeSubscription>[1], now, opts)).resumed) resumed++
  }
  return resumed
}

export type ResumeOutcome = 'resumed' | 'busy' | 'failed'

type ResumeReadSub = Pick<Stripe.Subscription, 'status' | 'cancel_at_period_end' | 'cancel_at'>
const isEnding = (s: ResumeReadSub) => s.cancel_at_period_end === true || s.cancel_at != null

/**
 * Vera B1/B2: when "Resume plan" didn't resume anything itself (the lock was held by a double click or
 * a second tab, nothing was left to resume, or the update threw), the caller re-reads the customer's
 * live subscriptions from Stripe and decides from what Stripe says NOW:
 * - an active/trialing plan and none of them set to end -> 'resumed' (the other click already did it);
 * - still set to end while the lock was held -> 'busy' (RESUME_BUSY_MESSAGE);
 * - anything else (no live plan, still ending after a failure) -> 'failed' (RESUME_FAILED_MESSAGE).
 */
export function resumeOutcomeFromLive(live: readonly ResumeReadSub[], lockHeld: boolean): ResumeOutcome {
  const running = live.filter((s) => s.status === 'active' || s.status === 'trialing')
  if (running.length > 0 && !running.some(isEnding)) return 'resumed'
  if (lockHeld && running.some(isEnding)) return 'busy'
  return 'failed'
}
