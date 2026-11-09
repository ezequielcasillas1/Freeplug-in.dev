import { describe, expect, it } from 'vitest'
import { BUYOUT_TIERS, BUYOUT_TIER_PAGE_LIMITS, buyoutDueCents, buyoutPriceCents, buyoutTierById, buyoutTierForPages, buyoutTierSentence } from './tiers'

describe('buyout tiers (Nov 2026 pricing)', () => {
  it('per-page 1–5, then 6-7 $700, 8-11 $950, 12-15 $1,200, 16-25 $2,000, 26+ custom', () => {
    expect(BUYOUT_TIERS.map((t) => [t.id, t.cents])).toEqual([
      ['p1', 25000],
      ['p2', 30000],
      ['p3', 35000],
      ['p4', 40000],
      ['p5', 45000],
      ['up_to_7', 70000],
      ['up_to_11', 95000],
      ['up_to_15', 120000],
      ['up_to_25', 200000],
      ['custom', null],
    ])
    expect(BUYOUT_TIER_PAGE_LIMITS).toEqual([1, 2, 3, 4, 5, 7, 11, 15, 25])
  })

  it('maps page counts to the right tier and price', () => {
    expect([1, 2, 3, 4, 5].map((n) => buyoutTierForPages(n)!.cents)).toEqual([25000, 30000, 35000, 40000, 45000])
    expect([6, 7].map((n) => buyoutTierForPages(n)!.cents)).toEqual([70000, 70000])
    expect(buyoutTierForPages(11)!.cents).toBe(95000)
    expect(buyoutTierForPages(25)!.cents).toBe(200000)
    expect(buyoutTierForPages(26)!.id).toBe('custom')
    expect(buyoutTierForPages(100)!.id).toBe('custom')
    expect(buyoutTierForPages(0)).toBeNull()
  })

  it('due and override math', () => {
    expect(buyoutDueCents(95000, 30000)).toBe(65000)
    expect(buyoutDueCents(25000, 90000)).toBe(0)
    expect(buyoutPriceCents(buyoutTierById('up_to_11'), null)).toBe(95000)
    expect(buyoutPriceCents(buyoutTierForPages(30), 350000)).toBe(350000)
  })

  it('buyoutTierSentence lists fixed tiers', () => {
    expect(buyoutTierSentence()).toBe(
      '1 page $250, 2 pages $300, 3 pages $350, 4 pages $400, 5 pages $450, 6 to 7 pages $700, 8 to 11 pages $950, 12 to 15 pages $1,200, and 16 to 25 pages $2,000'
    )
  })

  it('buyout request notes carry the picked tier (informational only)', async () => {
    const { buyoutNoteBlock } = await import('./buyout')
    const now = new Date('2026-10-19T06:00:00.000Z')
    expect(buyoutNoteBlock(now, buyoutTierById('up_to_11'))).toBe(
      'Buyout request (dashboard):\nRequested: 2026-10-19T06:00:00.000Z\nTier picked: 8 to 11 pages ($950)'
    )
  })
})
