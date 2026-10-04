import { describe, expect, it } from 'vitest'
import { ADDONS, ADDON_STEP_LIMITS, entitlementsFor, PLAN_STEPS, withAddons, type PlanStepId } from './ladder'
import { addonCapCheck, addonCentsOfItems, addonIdsOfItems, addonOfPrice, isAddonPrice, parseAddonIds } from './addons'
import { parseTipDollars, tierItems, tipNudge, tipRangeFor } from './tips'
import { entitlementsFromSnapshot, snapshotOf } from './plan-snapshot'

const step = (id: PlanStepId) => PLAN_STEPS.find((s) => s.id === id)!
const small = { lookup_key: 'freeplug_addon_small_edit_monthly', product: 'freeplug_extra_small_edit', unit_amount: 500 }
const big = { lookup_key: 'freeplug_addon_big_change_monthly', product: 'freeplug_extra_big_change', unit_amount: 575 }

describe('add-on config (Oct 4)', () => {
  it('two live add-ons: +1 small edit $5 and Big change $5.75 flat, new product ids', () => {
    expect(ADDONS.map((a) => [a.id, a.monthlyCents, a.lookupKey, a.productId])).toEqual([
      ['small_edit', 500, 'freeplug_addon_small_edit_monthly', 'freeplug_extra_small_edit'],
      ['big_change', 575, 'freeplug_addon_big_change_monthly', 'freeplug_extra_big_change'],
    ])
    expect(ADDON_STEP_LIMITS).toEqual({ starter: { maxAddonCents: 1500, addonsInTipTotal: true } })
  })
})

describe('classification is exact (never a prefix, never a grandfathered add-on)', () => {
  it('matches by lookup key or fixed product id', () => {
    expect(addonOfPrice(small)?.id).toBe('small_edit')
    expect(addonOfPrice({ lookup_key: null, product: 'freeplug_extra_big_change' })?.id).toBe('big_change')
    expect(addonOfPrice({ lookup_key: null, product: { id: 'freeplug_extra_small_edit' } })?.id).toBe('small_edit')
  })
  it('legacy Basic/Plus/Pro add-ons, the tip and look-alikes are NOT add-ons', () => {
    for (const t of ['basic', 'plus', 'pro']) {
      expect(isAddonPrice({ lookup_key: `freeplug_addon_${t}_monthly`, product: `freeplug_addon_${t}_monthly` })).toBe(false)
    }
    expect(isAddonPrice({ lookup_key: 'freeplug_tip_monthly', product: 'freeplug_tip' })).toBe(false)
    expect(isAddonPrice({ lookup_key: 'freeplug_addon_small_edit_monthly_v2', product: 'freeplug_extra_small_edit_x' })).toBe(false)
    expect(isAddonPrice({ lookup_key: 'freeplug_addon_small', product: 'freeplug_extra' })).toBe(false)
    expect(isAddonPrice(null)).toBe(false)
  })
  it('tierItems = the plan only (no tip, no add-on); add-on ids/cents from Stripe amounts', () => {
    const items = [
      { price: { lookup_key: step('starter').lookupKey, unit_amount: 3500 } },
      { price: big, quantity: 1 },
      { price: { lookup_key: 'freeplug_tip_monthly', product: 'freeplug_tip', unit_amount: 100 }, quantity: 4 },
      { price: small, quantity: 1 },
    ]
    expect(tierItems(items)).toEqual([items[0]])
    expect(addonIdsOfItems(items)).toEqual(['small_edit', 'big_change'])
    expect(addonCentsOfItems(items)).toBe(1075)
  })
  it('parseAddonIds: known ids once each, ADDONS order; anything else refused', () => {
    expect(parseAddonIds(undefined)).toEqual([])
    expect(parseAddonIds(['big_change', 'small_edit'])).toEqual(['small_edit', 'big_change'])
    expect(parseAddonIds(['small_edit', 'small_edit'])).toBeNull()
    expect(parseAddonIds(['visitor_snapshot'])).toBeNull()
    expect(parseAddonIds(['quote_alert'])).toBeNull()
    expect(parseAddonIds('small_edit')).toBeNull()
    expect(parseAddonIds(['small_edit', 'big_change', 'small_edit'])).toBeNull()
  })
})

describe('caps (server only): Starter add-ons <= $15, each at most once', () => {
  it('today both add-ons ($10.75) fit Starter', () => {
    expect(addonCapCheck('starter', [{ id: 'small_edit', cents: 500 }, { id: 'big_change', cents: 575 }])).toEqual({ ok: true })
  })
  it('over $15 on Starter is refused; other steps have no add-on cap', () => {
    expect(addonCapCheck('starter', [{ id: 'small_edit', cents: 1000 }, { id: 'big_change', cents: 575 }])).toEqual({ ok: false, code: 'over_cap', maxAddonCents: 1500 })
    expect(addonCapCheck('starter', [{ id: 'small_edit', cents: 1500 }])).toEqual({ ok: true })
    expect(addonCapCheck('priority', [{ id: 'small_edit', cents: 1000 }, { id: 'big_change', cents: 900 }])).toEqual({ ok: true })
  })
  it('the same add-on twice is refused on every step', () => {
    for (const s of ['starter', 'priority', 'fast_lane'] as const) {
      expect(addonCapCheck(s, [{ id: 'small_edit', cents: 500 }, { id: 'small_edit', cents: 500 }])).toMatchObject({ ok: false, code: 'duplicate' })
    }
  })
})

describe('Starter $54 total: tip max = floor($54 - $35 - add-ons)', () => {
  it.each([
    [0, 19],
    [500, 14],
    [575, 13],
    [1075, 8],
  ])('add-ons %i cents -> max tip $%i', (addonCents, max) => {
    expect(tipRangeFor(step('starter'), undefined, addonCents)).toEqual({ minTip: 0, maxTip: max, minTotal: 35, maxTotal: 35 + max })
    expect(parseTipDollars(step('starter'), max, undefined, addonCents)).toEqual({ ok: true, tipDollars: max })
    expect(parseTipDollars(step('starter'), max + 1, undefined, addonCents)).toEqual({ ok: false, code: 'out_of_range' })
  })
  it('plan + add-ons + tip never passes $54 on Starter', () => {
    for (const addonCents of [0, 500, 575, 1075]) {
      const max = tipRangeFor(step('starter'), undefined, addonCents)!.maxTip
      expect(3500 + addonCents + max * 100).toBeLessThanOrEqual(5400)
      expect(3500 + addonCents + (max + 1) * 100).toBeGreaterThan(5400)
    }
  })
  it('other steps: add-ons do not change the tip range', () => {
    expect(tipRangeFor(step('priority'), undefined, 1075)?.maxTip).toBe(9)
    expect(tipRangeFor(step('fast_lane'), undefined, 1075)?.maxTip).toBe(9)
  })
  it('the nudge never shows for a tip above the add-on-lowered max', () => {
    expect(tipNudge(step('starter'), 15)?.next.id).toBe('priority')
    expect(tipNudge(step('starter'), 15, undefined, 500)).toBeNull()
    expect(tipNudge(step('starter'), 13, undefined, 575)).toBeNull() // $35 + $13 is $7 from Priority
    expect(tipNudge(step('priority'), 5, undefined, 1075)?.next.id).toBe('fast_lane')
  })
})

describe('entitlements from add-ons', () => {
  it('+1 small edit adds one included edit (Starter 1, Fast lane 2); Big change gives one big change', () => {
    expect(withAddons(entitlementsFor({ stepId: 'starter' }), ['small_edit']).includedEditsPerMonth).toBe(1)
    expect(withAddons(entitlementsFor({ stepId: 'fast_lane' }), ['small_edit']).includedEditsPerMonth).toBe(2)
    const both = withAddons(entitlementsFor({ stepId: 'priority' }), ['small_edit', 'big_change'])
    expect(both).toMatchObject({ includedEditsPerMonth: 1, bigChangesPerMonth: 1, addons: ['small_edit', 'big_change'], addonCents: 1075 })
    // never a queue rank or a price change
    expect(both.priorityRank).toBe(entitlementsFor({ stepId: 'priority' }).priorityRank)
    expect(both.monthlyCents).toBe(5500)
  })
  it('grandfathered plans and no plan get nothing from add-ons', () => {
    const legacy = entitlementsFor({ legacy: { hostingCents: 4000, addonTier: 'plus' } })
    expect(withAddons(legacy, ['small_edit', 'big_change'])).toEqual(legacy)
  })
  it('the snapshot round-trips add-ons (plan_addons) and ignores unknown values', () => {
    const e = withAddons(entitlementsFor({ stepId: 'fast_lane' }), ['small_edit', 'big_change'])
    const snap = snapshotOf(e)
    expect(snap.addons).toEqual(['small_edit', 'big_change'])
    const row = { plan_step: snap.stepId, plan_legacy: snap.legacy, plan_legacy_addon: snap.legacyAddon, plan_monthly_cents: snap.monthlyCents, plan_tip_cents: 0, plan_addons: snap.addons }
    expect(entitlementsFromSnapshot(row)).toEqual(e)
    expect(entitlementsFromSnapshot({ ...row, plan_addons: ['bogus'] })).toEqual(entitlementsFor({ stepId: 'fast_lane' }))
    expect(entitlementsFromSnapshot({ ...row, plan_addons: null }).addons).toEqual([])
  })
})
