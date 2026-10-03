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
