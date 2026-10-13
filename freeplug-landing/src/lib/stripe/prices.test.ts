// @vitest-environment node
import { beforeEach, describe, expect, it, vi } from 'vitest'
import type Stripe from 'stripe'
import { PLAN_STEPS } from '@/lib/plans/ladder'
import { PriceNotConfiguredError, getStepPriceId, resetStepPriceCache } from './prices'

function price(over: Record<string, unknown> = {}, stepIdx = 0) {
  const s = PLAN_STEPS[stepIdx]
  return {
    id: `price_${s.id}`,
    lookup_key: s.lookupKey,
    product: s.productId,
    active: true,
    currency: 'usd',
    unit_amount: s.monthlyCents,
    type: 'recurring',
    recurring: { interval: 'month', interval_count: 1 },
    ...over,
  }
}
function fake(data: unknown[]) {
  const list = vi.fn(async () => ({ data }))
  return { stripe: { prices: { list } } as unknown as Stripe, list }
}

describe('getStepPriceId (lookup keys, fail closed)', () => {
  beforeEach(() => resetStepPriceCache())

  it('resolves every step by its lookup key in one list call, then caches', async () => {
    const f = fake(PLAN_STEPS.map((_, i) => price({}, i)))
    for (const s of PLAN_STEPS) expect(await getStepPriceId(s.id, f.stripe, 1000)).toBe(`price_${s.id}`)
    expect(f.list).toHaveBeenCalledTimes(1)
    expect(f.list).toHaveBeenCalledWith({ lookup_keys: PLAN_STEPS.map((s) => s.lookupKey), active: true, limit: 100 })
  })

  it('re-reads after the 10 minute TTL', async () => {
    const f = fake(PLAN_STEPS.map((_, i) => price({}, i)))
    await getStepPriceId('starter', f.stripe, 0)
    await getStepPriceId('starter', f.stripe, 9 * 60_000)
    expect(f.list).toHaveBeenCalledTimes(1)
    await getStepPriceId('starter', f.stripe, 11 * 60_000)
    expect(f.list).toHaveBeenCalledTimes(2)
  })

  it.each([
    ['missing', []],
    ['wrong amount', [price({ unit_amount: 3400 })]],
    ['wrong product (e.g. the retired single product)', [price({ product: 'freeplug_hosting_ladder' })]],
    ['wrong currency', [price({ currency: 'eur' })]],
    ['inactive', [price({ active: false })]],
    ['yearly', [price({ recurring: { interval: 'year', interval_count: 1 } })]],
    ['every 2 months', [price({ recurring: { interval: 'month', interval_count: 2 } })]],
    ['one-time', [price({ type: 'one_time', recurring: null })]],
  ])('%s price -> PriceNotConfiguredError', async (_label, data) => {
    const f = fake(data)
    await expect(getStepPriceId('starter', f.stripe)).rejects.toBeInstanceOf(PriceNotConfiguredError)
  })
})

describe('getAddonPriceId (Oct 4): validated like the step prices, fails closed', () => {
  const load = async () => await import('./prices')
  const addonPrice = (id: 'small_edit' | 'big_change', over: Record<string, unknown> = {}) => {
    const a = { small_edit: ['freeplug_addon_small_edit_monthly', 'freeplug_extra_small_edit', 500], big_change: ['freeplug_addon_big_change_monthly', 'freeplug_extra_big_change', 575] }[id]
    return { id: `price_${id}`, lookup_key: a[0], product: a[1], active: true, currency: 'usd', unit_amount: a[2], type: 'recurring', recurring: { interval: 'month', interval_count: 1, usage_type: 'licensed' }, ...over }
  }
  it('returns the price behind each lookup key when it matches ladder.ts', async () => {
    const { getAddonPriceId, resetAddonPriceCache } = await load()
    resetAddonPriceCache()
    const list = vi.fn(async () => ({ data: [addonPrice('small_edit'), addonPrice('big_change')] }))
    const stripe = { prices: { list } } as unknown as Stripe
    expect(await getAddonPriceId('small_edit', stripe, 1)).toBe('price_small_edit')
    expect(await getAddonPriceId('big_change', stripe, 2)).toBe('price_big_change')
    expect(list).toHaveBeenCalledTimes(1)
  })
  it.each([
    ['another amount', { unit_amount: 600 }],
    ['a grandfathered product', { product: 'freeplug_addon_plus_monthly' }],
    ['inactive', { active: false }],
    ['yearly', { recurring: { interval: 'year', interval_count: 1 } }],
    ['metered', { recurring: { interval: 'month', interval_count: 1, usage_type: 'metered' } }],
  ])('refuses %s', async (_l, over) => {
    const { getAddonPriceId, resetAddonPriceCache } = await load()
    resetAddonPriceCache()
    const stripe = { prices: { list: vi.fn(async () => ({ data: [addonPrice('big_change', over)] })) } } as unknown as Stripe
    await expect(getAddonPriceId('big_change', stripe, 1)).rejects.toBeInstanceOf(PriceNotConfiguredError)
  })
})
