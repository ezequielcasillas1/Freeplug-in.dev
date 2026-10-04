import type Stripe from 'stripe'
import type { PlanStepId } from './ladder'
import { getEntitlements } from '@/lib/stripe/active-subscription'
import { isMissingColumnError, snapshotOf, type PlanSnapshot } from './plan-snapshot'

/**
 * Webhook: write the customer's entitlement snapshot on profiles (plan_step, plan_legacy,
 * plan_legacy_addon, plan_monthly_cents, plan_step_synced_at). This is the ONLY writer: the app
 * reads perks from the snapshot (src/lib/plans/plan-snapshot.ts), so entitlements change when this
 * webhook runs, not when a plan move's API call returns or a schedule is created (a schedule
 * leaves the subscription's items as they are, so a re-sync then writes the same step).
 *
 * Retry-safe and order-independent: on every customer.subscription.created|updated|deleted it
 * recomputes the step from the customer's CURRENT live subscriptions in Stripe (lookup key or
 * metadata.plan_step, else the legacy plan's monthly total), never from the event payload, so a
 * redelivered or out-of-order event writes the same value. A failure throws; the webhook answers
 * 500 and Stripe redelivers.
 */
export interface PlanStepStore {
  /** Writes the snapshot + plan_step_synced_at for the profile(s) with this Stripe customer; returns rows changed. */
  writePlanStep(customerId: string, snapshot: PlanSnapshot, syncedAt: string): Promise<number>
}

export type PlanStepSyncResult = { outcome: 'synced' | 'no_profile'; stepId: PlanStepId | null }

export async function syncPlanStepForCustomer(
  deps: { stripe: Stripe; store: PlanStepStore; now?: () => Date },
  customerId: string
): Promise<PlanStepSyncResult> {
  const snapshot = snapshotOf(await getEntitlements(customerId, deps.stripe))
  const rows = await deps.store.writePlanStep(customerId, snapshot, (deps.now?.() ?? new Date()).toISOString())
  return { outcome: rows > 0 ? 'synced' : 'no_profile', stepId: snapshot.stepId }
}

/** Service-role store (a guard trigger stops customers writing any snapshot column). */
export function supabasePlanStepStore(admin: {
  from: (t: 'profiles') => {
    update: (v: Record<string, unknown>) => {
      eq: (c: string, v: string) => { select: (c: string) => PromiseLike<{ data: unknown[] | null; error: { message: string; code?: string } | null }> }
    }
  }
}): PlanStepStore {
  return {
    async writePlanStep(customerId, snapshot, syncedAt) {
      const base = {
        plan_step: snapshot.stepId,
        plan_legacy: snapshot.legacy,
        plan_legacy_addon: snapshot.legacyAddon,
        plan_monthly_cents: snapshot.monthlyCents,
        plan_step_synced_at: syncedAt,
      }
      // Newest columns first; each fallback drops the column a not-yet-applied migration adds, so the
      // webhook never fails (and gets redelivered) over a missing column: plan_addons (20261004090000,
      // add-ons), then plan_tip_cents (20261003200000, tipping, display only).
      const attempts: Record<string, unknown>[] = [
        { ...base, plan_tip_cents: snapshot.tipCents, plan_addons: snapshot.addons },
        { ...base, plan_tip_cents: snapshot.tipCents },
        base,
      ]
      let data: unknown[] | null = null
      let error: { message: string; code?: string } | null = null
      for (const values of attempts) {
        ;({ data, error } = await admin.from('profiles').update(values).eq('stripe_customer_id', customerId).select('id'))
        if (!error || !isMissingColumnError(error)) break
      }
      if (error) throw new Error(`profiles plan_step update: ${error.message}`)
      return data?.length ?? 0
    },
  }
}
