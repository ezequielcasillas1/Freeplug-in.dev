import { describe, expect, it } from 'vitest'
import { BUYOUT_TIERS, BUYOUT_TIER_PAGE_LIMITS, buyoutDueCents, buyoutPriceCents, buyoutTierById, buyoutTierForPages, buyoutTierSentence } from './tiers'

describe('buyout tiers (Cheke, Oct 19)', () => {
  it('prices: 5 pages $500, 7 $700, 11 $950, 12-15 $1,200, 16+ Unlimited $2,000', () => {
    expect(BUYOUT_TIERS.map((t) => [t.id, t.cents])).toEqual([
      ['quick', 50000], ['up_to_7', 70000], ['up_to_11', 95000], ['up_to_15', 120000], ['unlimited', 200000],
    ])
    expect(BUYOUT_TIER_PAGE_LIMITS).toEqual([5, 7, 11, 15])
  })
  it('every page count 1..40 lands in exactly one counted tier, no gaps (8 to 11 = $950)', () => {
    for (let n = 1; n <= 40; n++) expect(buyoutTierForPages(n)).not.toBeNull()
    expect([1, 5].map((n) => buyoutTierForPages(n)!.cents)).toEqual([50000, 50000])
    expect([6, 7].map((n) => buyoutTierForPages(n)!.cents)).toEqual([70000, 70000])
    expect([8, 9, 10, 11].map((n) => buyoutTierForPages(n)!.cents)).toEqual([95000, 95000, 95000, 95000])
    expect([12, 15].map((n) => buyoutTierForPages(n)!.cents)).toEqual([120000, 120000])
    expect([16, 30].map((n) => buyoutTierForPages(n)!.id)).toEqual(['unlimited', 'unlimited'])
    expect(buyoutTierForPages(0)).toBeNull()
    expect(buyoutTierForPages(2.5)).toBeNull()
  })
  it('counted tiers touch end to end', () => {
    const counted = BUYOUT_TIERS.filter((t) => t.minPages != null)
    for (let i = 1; i < counted.length; i++) expect(counted[i].minPages).toBe(counted[i - 1].maxPages! + 1)
  })
  it('the admin price overrides the tier; nothing over $2,000 from tiers', () => {
    const t = buyoutTierById('up_to_11')
    expect(buyoutPriceCents(t, null)).toBe(95000)
    expect(buyoutPriceCents(t, 80000)).toBe(80000)
    expect(buyoutPriceCents(null, null)).toBeNull()
    expect(Math.max(...BUYOUT_TIERS.map((x) => x.cents))).toBe(200000)
  })
  it('every dollar paid counts toward the buyout, never below $0', () => {
    expect(buyoutDueCents(95000, 30000)).toBe(65000)
    expect(buyoutDueCents(50000, 90000)).toBe(0)
    expect(buyoutDueCents(50000, -100)).toBe(50000)
  })
  it('the sentence is built from the config', () => {
    expect(buyoutTierSentence()).toBe('up to 5 pages $500, up to 7 pages $700, up to 11 pages $950, 12 to 15 pages $1,200, and 16 or more pages $2,000')
  })
})

describe('final tier edges (Cheke via Jace, Oct 19 6:08 AM CT)', () => {
  it('11 -> $950, 12 -> $1,200', () => {
    expect(buyoutTierForPages(11)!.id).toBe('up_to_11')
    expect(buyoutTierForPages(12)!.id).toBe('up_to_15')
  })
  it('15 -> $1,200, 16 -> Unlimited $2,000', () => {
    expect(buyoutTierForPages(15)!.cents).toBe(120000)
    expect(buyoutTierForPages(16)!.id).toBe('unlimited')
    expect(buyoutTierForPages(16)!.cents).toBe(200000)
  })
  it('a large page count is Unlimited, never above $2,000', () => {
    expect(buyoutTierForPages(10_000)!.id).toBe('unlimited')
    expect(buyoutTierForPages(10_000)!.cents).toBe(200000)
  })
  it('labels (Sable, final)', () => {
    expect(buyoutTierById('up_to_15')!.label).toBe('12 to 15 pages')
    expect(buyoutTierById('unlimited')!.label).toBe('Unlimited: 16 or more pages')
    expect(buyoutTierById('more_pages')).toBeNull()
  })
})

describe('buyout request notes carry the picked tier (informational only)', () => {
  it('adds a "Tier picked" line', async () => {
    const { buyoutNoteBlock } = await import('./buyout')
    const now = new Date('2026-10-19T06:00:00Z')
    expect(buyoutNoteBlock(now, buyoutTierById('up_to_11'))).toBe('Buyout request (dashboard):\nRequested: 2026-10-19T06:00:00.000Z\nTier picked: Up to 11 pages ($950)')
    expect(buyoutNoteBlock(now)).toBe('Buyout request (dashboard):\nRequested: 2026-10-19T06:00:00.000Z')
  })
})

describe('override cap migration (Luma QA Oct 19)', () => {
  it('adds CHECK whole dollars $1..$2,000', async () => {
    const { readFileSync } = await import('node:fs')
    const sql = readFileSync(`${__dirname}/../../../supabase/migrations/20261019100000_buyout_price_cap_2000.sql`, 'utf8')
    expect(sql).toContain('check (buyout_price_cents is null or (buyout_price_cents between 100 and 200000 and buyout_price_cents % 100 = 0))')
  })
})
