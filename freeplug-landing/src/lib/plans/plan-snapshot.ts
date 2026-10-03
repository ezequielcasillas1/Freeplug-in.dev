import {
  entitlementsFor,
  isPlanStepId,
  legacyAddonById,
  NO_PLAN_ENTITLEMENTS,
  type Entitlements,
  type LegacyAddonTierId,
  type PlanStepId,
} from './ladder'

/**
 * The customer's entitlement snapshot on profiles (migration 20261003180000), written ONLY by the
 * Stripe webhook from Stripe's actual subscription (src/lib/plans/plan-step-sync.ts). The app reads
 * perks from here, so a plan move changes plan_step and perks when the customer.subscription.*
 * webhook lands, never when a schedule is created or a Stripe API call returns (Aria, Oct 3 12:25).
 */
export type PlanSnapshot = {
  stepId: PlanStepId | null
  legacy: boolean
  legacyAddon: LegacyAddonTierId | null
  monthlyCents: number | null
}

export type PlanSnapshotRow = {
  plan_step: string | null
  plan_legacy: boolean | null
  plan_legacy_addon: string | null
  plan_monthly_cents: number | null
  plan_step_synced_at: string | null
}

export const PLAN_SNAPSHOT_COLUMNS = 'plan_step, plan_legacy, plan_legacy_addon, plan_monthly_cents, plan_step_synced_at'

export function snapshotOf(ent: Entitlements): PlanSnapshot {
  return {
    stepId: ent.step?.id ?? null,
    legacy: ent.legacy,
    legacyAddon: ent.legacy ? ent.legacyAddon : null,
    monthlyCents: ent.step || ent.legacy ? ent.monthlyCents : null,
  }
}

/** Entitlements from a synced row (exact inverse of snapshotOf for every ladder and legacy plan). */
export function entitlementsFromSnapshot(row: Pick<PlanSnapshotRow, 'plan_step' | 'plan_legacy' | 'plan_legacy_addon' | 'plan_monthly_cents'>): Entitlements {
  if (row.plan_legacy) {
    const addon = legacyAddonById(row.plan_legacy_addon)
    const total = Math.max(0, row.plan_monthly_cents ?? 0)
    return entitlementsFor({ legacy: { hostingCents: total - (addon?.monthlyCents ?? 0), addonTier: addon?.id ?? null } })
  }
  if (isPlanStepId(row.plan_step)) return entitlementsFor({ stepId: row.plan_step })
  return NO_PLAN_ENTITLEMENTS
}

export type EntitlementSource = 'webhook' | 'stripe_fallback' | 'none'

/**
 * Perks for display and admin actions. A synced row (plan_step_synced_at set) is the answer. A
 * profile the webhook has never synced (customers from before this deploy) falls back to reading
 * Stripe until its first webhook; changeHostingPlan syncs before any move, so a move itself never
 * goes through the fallback.
 */
export async function resolveEntitlements(
  row: PlanSnapshotRow | null,
  customerId: string | null,
  live: (customerId: string) => Promise<Entitlements>
): Promise<{ entitlements: Entitlements; source: EntitlementSource }> {
  if (row?.plan_step_synced_at) return { entitlements: entitlementsFromSnapshot(row), source: 'webhook' }
  if (!customerId) return { entitlements: NO_PLAN_ENTITLEMENTS, source: 'none' }
  return { entitlements: await live(customerId), source: 'stripe_fallback' }
}

type ProfilesReader = {
  from: (t: 'profiles') => {
    select: (c: string) => {
      eq: (c: string, v: string) => { maybeSingle: () => PromiseLike<{ data: unknown; error: { message: string } | null }> }
    }
  }
}

/** Reads the snapshot row for a profile; a read error (e.g. migration not applied) = not synced. */
export async function loadPlanSnapshotRow(client: unknown, userId: string): Promise<PlanSnapshotRow | null> {
  const { data, error } = await (client as ProfilesReader).from('profiles').select(PLAN_SNAPSHOT_COLUMNS).eq('id', userId).maybeSingle()
  if (error) {
    console.error('[plan-snapshot] read failed, using Stripe', error.message)
    return null
  }
  return (data as PlanSnapshotRow | null) ?? null
}
