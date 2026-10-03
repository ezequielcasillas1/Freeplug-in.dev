import { describe, expect, it, vi } from 'vitest'
import { entitlementsFor, LEGACY_ADDON_TIERS, NO_PLAN_ENTITLEMENTS, PLAN_STEPS } from './ladder'
import { entitlementsFromSnapshot, loadPlanSnapshotRow, resolveEntitlements, snapshotOf, type PlanSnapshotRow } from './plan-snapshot'

const row = (s: ReturnType<typeof snapshotOf>, synced: string | null = '2026-10-03T17:00:00Z'): PlanSnapshotRow => ({
  plan_step: s.stepId,
  plan_legacy: s.legacy,
  plan_legacy_addon: s.legacyAddon,
  plan_monthly_cents: s.monthlyCents,
  plan_step_synced_at: synced,
})

describe('plan snapshot (webhook-written entitlements)', () => {
  it('round-trips every ladder step exactly', () => {
    for (const s of PLAN_STEPS) {
      const e = entitlementsFor({ stepId: s.id })
      expect(entitlementsFromSnapshot(row(snapshotOf(e)))).toEqual(e)
    }
  })

  it('round-trips grandfathered plans exactly (perks from the add-on, never ladder perks)', () => {
    for (const hostingCents of [3500, 4000, 6000, 10000]) {
      for (const addonTier of [null, ...LEGACY_ADDON_TIERS.map((t) => t.id)]) {
        const e = entitlementsFor({ legacy: { hostingCents, addonTier } })
        expect(entitlementsFromSnapshot(row(snapshotOf(e)))).toEqual(e)
      }
    }
  })

  it('no plan -> no perks', () => {
    expect(snapshotOf(NO_PLAN_ENTITLEMENTS)).toEqual({ stepId: null, legacy: false, legacyAddon: null, monthlyCents: null, tipCents: 0 })
    expect(entitlementsFromSnapshot(row(snapshotOf(NO_PLAN_ENTITLEMENTS)))).toEqual(NO_PLAN_ENTITLEMENTS)
  })
})

describe('resolveEntitlements', () => {
  const live = vi.fn(async () => entitlementsFor({ stepId: 'fast_lane' }))

  it('a synced row is the answer: Stripe is not read, even if Stripe already shows a new plan', async () => {
    live.mockClear()
    const r = await resolveEntitlements(row(snapshotOf(entitlementsFor({ stepId: 'starter' }))), 'cus_1', live)
    expect(r).toMatchObject({ source: 'webhook', entitlements: { step: { id: 'starter' } } })
    expect(live).not.toHaveBeenCalled()
  })

  it('a never-synced profile reads Stripe until its first webhook; no customer = no plan', async () => {
    expect(await resolveEntitlements(row(snapshotOf(NO_PLAN_ENTITLEMENTS), null), 'cus_1', live)).toMatchObject({ source: 'stripe_fallback', entitlements: { step: { id: 'fast_lane' } } })
    expect(await resolveEntitlements(null, null, live)).toEqual({ source: 'none', entitlements: NO_PLAN_ENTITLEMENTS })
  })

  it('a read error (migration not applied yet) counts as not synced', async () => {
    const client = { from: () => ({ select: () => ({ eq: () => ({ maybeSingle: async () => ({ data: null, error: { message: 'column does not exist' } }) }) }) }) }
    vi.spyOn(console, 'error').mockImplementation(() => undefined)
    expect(await loadPlanSnapshotRow(client, 'u1')).toBeNull()
  })
})
