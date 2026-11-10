import { describe, expect, it } from 'vitest'
import { computeMerchLayerBalance } from './layer-balance'
import { buildMerchLayerAssignmentTable } from './layer-map'
import { sortFeaturedLayerRoundRobin } from './layer-sort'
import type { CatalogFilterItem } from '@/lib/merch/catalog-filter-types'

describe('merch layers', () => {
  it('assigns a layer to every catalog row', () => {
    const table = buildMerchLayerAssignmentTable()
    expect(table.length).toBeGreaterThan(200)
    for (const row of table) {
      expect(['everyday', 'give', 'mind']).toContain(row.layer)
    }
  })

  it('reports Give home-faith and good-measure items', () => {
    const table = buildMerchLayerAssignmentTable()
    const giveKeys = table.filter((r) => r.layer === 'give').map((r) => r.key)
    expect(giveKeys).toContain('home-faith/kjv-woven-blanket')
    expect(giveKeys).toContain('apparel/good-measure-longsleeve')
    expect(giveKeys.filter((k) => k.startsWith('shop/')).length).toBe(0)
  })

  it('round-robin featured sort interleaves layers', () => {
    const items: CatalogFilterItem[] = [
      {
        key: 'a',
        href: '/a',
        title: 'a',
        sortName: 'a',
        image: '',
        fromPriceCents: 1,
        featuredRank: 1,
        category: 'apparel',
        productType: 't-shirt',
        source: 't-shirts',
        colors: [],
        sizes: [],
        availability: ['buyable'],
        designs: ['freeplug'],
        comingSoonLabel: false,
        layer: 'everyday',
      },
      {
        key: 'b',
        href: '/b',
        title: 'b',
        sortName: 'b',
        image: '',
        fromPriceCents: 1,
        featuredRank: 1,
        category: 'home',
        productType: 'home-faith',
        source: 'merch-store',
        colors: [],
        sizes: [],
        availability: ['buyable'],
        designs: ['freeplug'],
        comingSoonLabel: false,
        layer: 'give',
      },
      {
        key: 'c',
        href: '/c',
        title: 'c',
        sortName: 'c',
        image: '',
        fromPriceCents: 1,
        featuredRank: 1,
        category: 'apparel',
        productType: 't-shirt',
        source: 't-shirts',
        colors: [],
        sizes: [],
        availability: ['buyable'],
        designs: ['freeplug'],
        comingSoonLabel: false,
        layer: 'everyday',
      },
    ]
    const sorted = sortFeaturedLayerRoundRobin(items)
    expect(sorted.map((i) => i.layer)).toEqual(['everyday', 'give', 'everyday'])
  })

  it('balance check warns when a layer exceeds 40%', () => {
    const report = computeMerchLayerBalance()
    expect(report.total).toBeGreaterThan(0)
    expect(report.counts.everyday).toBeGreaterThan(report.counts.give)
    expect(report.warnings.some((w) => w.includes('everyday'))).toBe(true)
  })
})
