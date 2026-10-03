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
  /** The tipping system: monthly tip in cents (0 = none). Display only, never a perk. */
  tipCents: number
}

export type PlanSnapshotRow = {
  plan_step: string | null
  plan_legacy: boolean | null
  plan_legacy_addon: string | null
  plan_monthly_cents: number | null
  plan_step_synced_at: string | null
  /** Migration 20261003200000 (tipping system); absent before it is applied. */
  plan_tip_cents?: number | null
}

export const PLAN_SNAPSHOT_COLUMNS_BASE = 'plan_step, plan_legacy, plan_legacy_addon, plan_monthly_cents, plan_step_synced_at'
export const PLAN_SNAPSHOT_COLUMNS = `${PLAN_SNAPSHOT_COLUMNS_BASE}, plan_tip_cents`

/** Undefined column (42703) or PostgREST's schema-cache miss (PGRST204 / 42703 text): a migration not applied yet. */
export function isMissingColumnError(error: { code?: string; message?: string } | null | undefined): boolean {
  if (!error) return false
  return error.code === '42703' || error.code === 'PGRST204' || /column .* does not exist|Could not find the .* column/i.test(error.message ?? '')
}

export function snapshotOf(ent: Entitlements): PlanSnapshot {
  return {
    stepId: ent.step?.id ?? null,
    legacy: ent.legacy,
    legacyAddon: ent.legacy ? ent.legacyAddon : null,
    monthlyCents: ent.step || ent.legacy ? ent.monthlyCents : null,
    tipCents: ent.step || ent.legacy ? Math.max(0, ent.tipCents ?? 0) : 0,
  }
}

/** Entitlements from a synced row (exact inverse of snapshotOf for every ladder and legacy plan). */
export function entitlementsFromSnapshot(row: Pick<PlanSnapshotRow, 'plan_step' | 'plan_legacy' | 'plan_legacy_addon' | 'plan_monthly_cents' | 'plan_tip_cents'>): Entitlements {
  const tipCents = Math.max(0, row.plan_tip_cents ?? 0)
  if (row.plan_legacy) {
    const addon = legacyAddonById(row.plan_legacy_addon)
    const total = Math.max(0, row.plan_monthly_cents ?? 0)
    return { ...entitlementsFor({ legacy: { hostingCents: total - (addon?.monthlyCents ?? 0), addonTier: addon?.id ?? null } }), tipCents }
  }
  if (isPlanStepId(row.plan_step)) return { ...entitlementsFor({ stepId: row.plan_step }), tipCents }
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
      eq: (c: string, v: string) => { maybeSingle: () => PromiseLike<{ data: unknown; error: { message: string; code?: string } | null }> }
    }
  }
}

/** Reads the snapshot row for a profile; a read error (e.g. migration not applied) = not synced. */
export async function loadPlanSnapshotRow(client: unknown, userId: string): Promise<PlanSnapshotRow | null> {
  const reader = client as ProfilesReader
  let { data, error } = await reader.from('profiles').select(PLAN_SNAPSHOT_COLUMNS).eq('id', userId).maybeSingle()
  // Before the tipping migration: read the snapshot without plan_tip_cents (tip shows as $0).
  if (error && isMissingColumnError(error)) {
    ;({ data, error } = await reader.from('profiles').select(PLAN_SNAPSHOT_COLUMNS_BASE).eq('id', userId).maybeSingle())
  }
  if (error) {
    console.error('[plan-snapshot] read failed, using Stripe', error.message)
    return null
  }
  return (data as PlanSnapshotRow | null) ?? null
}
