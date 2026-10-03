import type Stripe from 'stripe'
import type { PlanStepId } from './ladder'
import { getEntitlements } from '@/lib/stripe/active-subscription'

/**
 * Webhook: cache the customer's plan step on profiles.plan_step (admin queue order + badge).
 *
 * Retry-safe and order-independent: on every customer.subscription.created|updated|deleted it
 * recomputes the step from the customer's CURRENT live subscriptions in Stripe (lookup key or
 * metadata.plan_step, else the legacy plan's monthly total), never from the event payload, so a
 * redelivered or out-of-order event writes the same value. A failure throws; the webhook answers
 * 500 and Stripe redelivers.
 */
export interface PlanStepStore {
  /** Writes plan_step + plan_step_synced_at for the profile(s) with this Stripe customer; returns rows changed. */
  writePlanStep(customerId: string, stepId: PlanStepId | null, syncedAt: string): Promise<number>
}

export type PlanStepSyncResult = { outcome: 'synced' | 'no_profile'; stepId: PlanStepId | null }

export async function syncPlanStepForCustomer(
  deps: { stripe: Stripe; store: PlanStepStore; now?: () => Date },
  customerId: string
): Promise<PlanStepSyncResult> {
  const ent = await getEntitlements(customerId, deps.stripe)
  const stepId = ent.step?.id ?? null
  const rows = await deps.store.writePlanStep(customerId, stepId, (deps.now?.() ?? new Date()).toISOString())
  return { outcome: rows > 0 ? 'synced' : 'no_profile', stepId }
}

/** Service-role store (profiles is owner-select only; no client can write plan_step). */
export function supabasePlanStepStore(admin: {
  from: (t: 'profiles') => {
    update: (v: Record<string, unknown>) => {
      eq: (c: string, v: string) => { select: (c: string) => PromiseLike<{ data: unknown[] | null; error: { message: string } | null }> }
    }
  }
}): PlanStepStore {
  return {
    async writePlanStep(customerId, stepId, syncedAt) {
      const { data, error } = await admin
        .from('profiles')
        .update({ plan_step: stepId, plan_step_synced_at: syncedAt })
        .eq('stripe_customer_id', customerId)
        .select('id')
      if (error) throw new Error(`profiles plan_step update: ${error.message}`)
      return data?.length ?? 0
    },
  }
}
