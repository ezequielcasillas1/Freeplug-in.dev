import { describe, expect, it } from 'vitest'
import { BUYOUT_TIERS, BUYOUT_TIER_PAGE_LIMITS, buyoutDueCents, buyoutPriceCents, buyoutTierById, buyoutTierForPages, buyoutTierSentence } from './tiers'

describe('buyout tiers (Cheke, Oct 19)', () => {
  it('prices (Oct 30): 5 $500, 6-7 $700, 8-11 $950, 12-15 $1,200, 16-25 $2,000, 26+ Custom enterprise (no price)', () => {
    expect(BUYOUT_TIERS.map((t) => [t.id, t.cents])).toEqual([
      ['quick', 50000], ['up_to_7', 70000], ['up_to_11', 95000], ['up_to_15', 120000], ['up_to_25', 200000], ['custom', null],
    ])
    expect(BUYOUT_TIER_PAGE_LIMITS).toEqual([5, 7, 11, 15, 25])
  })
  it('every page count 1..40 lands in exactly one counted tier, no gaps (8 to 11 = $950)', () => {
    for (let n = 1; n <= 40; n++) expect(buyoutTierForPages(n)).not.toBeNull()
    expect([1, 5].map((n) => buyoutTierForPages(n)!.cents)).toEqual([50000, 50000])
    expect([6, 7].map((n) => buyoutTierForPages(n)!.cents)).toEqual([70000, 70000])
    expect([8, 9, 10, 11].map((n) => buyoutTierForPages(n)!.cents)).toEqual([95000, 95000, 95000, 95000])
    expect([12, 15].map((n) => buyoutTierForPages(n)!.cents)).toEqual([120000, 120000])
    expect([16, 25].map((n) => buyoutTierForPages(n)!.id)).toEqual(['up_to_25', 'up_to_25'])
    expect([26, 40].map((n) => buyoutTierForPages(n)!.id)).toEqual(['custom', 'custom'])
    expect(buyoutTierForPages(0)).toBeNull()
    expect(buyoutTierForPages(2.5)).toBeNull()
  })
  it('counted tiers touch end to end', () => {
    const counted = BUYOUT_TIERS.filter((t) => t.minPages != null)
    for (let i = 1; i < counted.length; i++) expect(counted[i].minPages).toBe(counted[i - 1].maxPages! + 1)
  })
  it('the admin price overrides the tier; nothing over $2,000 from fixed tiers', () => {
    const t = buyoutTierById('up_to_11')
    expect(buyoutPriceCents(t, null)).toBe(95000)
    expect(buyoutPriceCents(t, 80000)).toBe(80000)
    expect(buyoutPriceCents(null, null)).toBeNull()
    expect(Math.max(...BUYOUT_TIERS.flatMap((x) => (x.cents == null ? [] : [x.cents])))).toBe(200000)
    expect(buyoutTierById('custom')?.cents).toBeNull()
  })
  it('every dollar paid counts toward the buyout, never below $0', () => {
    expect(buyoutDueCents(95000, 30000)).toBe(65000)
    expect(buyoutDueCents(50000, 90000)).toBe(0)
    expect(buyoutDueCents(50000, -100)).toBe(50000)
  })
  it('the sentence is built from the config', () => {
    expect(buyoutTierSentence()).toBe('up to 5 pages $500, 6 to 7 pages $700, 8 to 11 pages $950, 12 to 15 pages $1,200, and 16 to 25 pages $2,000')
  })
})

describe('final tier edges (Cheke via Jace, Oct 19 6:08 AM CT)', () => {
  it('11 -> $950, 12 -> $1,200', () => {
    expect(buyoutTierForPages(11)!.id).toBe('up_to_11')
    expect(buyoutTierForPages(12)!.id).toBe('up_to_15')
  })
  it('15 -> $1,200, 16 -> $2,000, 25 -> $2,000, 26 -> Custom enterprise', () => {
    expect(buyoutTierForPages(15)!.cents).toBe(120000)
    expect(buyoutTierForPages(16)!.cents).toBe(200000)
    expect(buyoutTierForPages(25)!.cents).toBe(200000)
    expect(buyoutTierForPages(26)!.id).toBe('custom')
  })
  it('a large page count is Custom enterprise with no fixed price (admin override sets it)', () => {
    expect(buyoutTierForPages(10_000)!.id).toBe('custom')
    expect(buyoutTierForPages(10_000)!.cents).toBeNull()
    expect(buyoutPriceCents(buyoutTierForPages(30), null)).toBeNull()
    expect(buyoutPriceCents(buyoutTierForPages(30), 180000)).toBe(180000)
  })
  it('labels (Sable, final)', () => {
    expect(buyoutTierById('up_to_15')!.label).toBe('12 to 15 pages')
    expect(buyoutTierById('up_to_25')!.label).toBe('16 to 25 pages')
    expect(buyoutTierById('custom')!.label).toBe('Custom enterprise: 26 or more pages')
    expect(buyoutTierById('unlimited')).toBeNull()
    expect(buyoutTierById('more_pages')).toBeNull()
  })
})

describe('buyout request notes carry the picked tier (informational only)', () => {
  it('adds a "Tier picked" line', async () => {
    const { buyoutNoteBlock } = await import('./buyout')
    const now = new Date('2026-10-19T06:00:00Z')
    expect(buyoutNoteBlock(now, buyoutTierById('up_to_11'))).toBe('Buyout request (dashboard):\nRequested: 2026-10-19T06:00:00.000Z\nTier picked: 8 to 11 pages ($950)')
    expect(buyoutNoteBlock(now)).toBe('Buyout request (dashboard):\nRequested: 2026-10-19T06:00:00.000Z')
  })
})

describe('override cap migration (Luma QA Oct 19)', () => {
  it('adds CHECK whole dollars $1..$2,000', async () => {
    const { readFileSync } = await import('node:fs')
    const sql = readFileSync(`${__dirname}/../../../supabase/migrations/20261019100000_buyout_price_cap_2000.sql`, 'utf8')
    expect(sql).toContain('check (buyout_price_cents is null or (buyout_price_cents between 100 and 200000 and buyout_price_cents % 100 = 0))')
  })
  it('Oct 30: a new migration raises the cap to $100,000 (whole dollars, min $1) without editing the old one', async () => {
    const { readFileSync } = await import('node:fs')
    const sql = readFileSync(`${__dirname}/../../../supabase/migrations/20261030190000_buyout_price_cap_100000.sql`, 'utf8')
    expect(sql).toContain('drop constraint if exists website_requests_buyout_price_cents_max')
    expect(sql).toContain('check (buyout_price_cents is null or (buyout_price_cents between 100 and 10000000 and buyout_price_cents % 100 = 0))')
    const { BUYOUT_PRICE_MAX_DOLLARS, BUYOUT_PRICE_MIN_DOLLARS } = await import('./buyout')
    expect([BUYOUT_PRICE_MIN_DOLLARS, BUYOUT_PRICE_MAX_DOLLARS]).toEqual([1, 100_000])
  })
})
