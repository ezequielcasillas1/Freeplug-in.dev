import { describe, expect, it } from 'vitest'
import { listAllMerchItems } from './all-merch'
import {
  applyCatalogFilters,
  catalogFilterToSearchParams,
  computeCatalogFacets,
  matchesCatalogFilter,
  parseCatalogFilterSearchParams,
  sortCatalogItems,
} from './catalog-filter-logic'
import { listShopFilterItems } from './shop/shop-filter-items'

describe('catalog filter logic', () => {
  const all = listAllMerchItems()
  const shop = listShopFilterItems()

  it('parses and round-trips URL search params', () => {
    const q = new URLSearchParams('cat=hats,drinkware&avail=buyable&sort=price-asc&min=1000&max=5000&col=Black')
    const state = parseCatalogFilterSearchParams(q, 'all-merch')
    expect(state.categories).toEqual(['hats', 'drinkware'])
    expect(state.sort).toBe('price-asc')
    expect(state.minPriceCents).toBe(1000)
    expect(state.maxPriceCents).toBe(5000)
    expect(state.colors).toEqual(['Black'])
    const back = catalogFilterToSearchParams(state, 'all-merch')
    expect(back.get('cat')).toBe('hats,drinkware')
    expect(back.get('sort')).toBe('price-asc')
  })

  it('parses Supreme look, name, and style URL facets for sharing', () => {
    const state = parseCatalogFilterSearchParams(
      new URLSearchParams('preview=0&supreme=1&name=freeplug,fplgn&wstyle=box,stamp'),
      'shop'
    )
    expect(state.previewOverlays).toBe(false)
    expect(state.supremeLookOnly).toBe(true)
    expect(state.brandNameKeys).toEqual(['freeplug', 'fplgn'])
    expect(state.wordmarkStyleGroups).toEqual(['box', 'stamp'])
    const back = catalogFilterToSearchParams(state, 'shop')
    expect(back.get('preview')).toBe('0')
    expect(back.get('supreme')).toBe('1')
    expect(back.get('name')).toBe('freeplug,fplgn')
    expect(back.get('wstyle')).toBe('box,stamp')
  })

  it('accepts legacy style=rectangular as supreme look', () => {
    const state = parseCatalogFilterSearchParams(new URLSearchParams('style=rectangular'), 'all-merch')
    expect(state.supremeLookOnly).toBe(true)
  })

  it('filters hats that are buyable now on the full catalog', () => {
    const state = parseCatalogFilterSearchParams(new URLSearchParams('cat=hats&avail=buyable'), 'all-merch')
    const out = applyCatalogFilters(all, state)
    expect(out.length).toBeGreaterThan(0)
    expect(out.every((i) => i.category === 'hats')).toBe(true)
    expect(out.every((i) => i.availability.includes('buyable'))).toBe(true)
  })

  it('sorts shop items by price ascending', () => {
    const sorted = sortCatalogItems(shop, 'price-asc')
    for (let i = 1; i < sorted.length; i++) {
      expect(sorted[i]!.fromPriceCents).toBeGreaterThanOrEqual(sorted[i - 1]!.fromPriceCents)
    }
  })

  it('filters buyer-shop source only on all merch', () => {
    const state = parseCatalogFilterSearchParams(new URLSearchParams('src=buyer-shop'), 'all-merch')
    const out = applyCatalogFilters(all, state)
    expect(out).toHaveLength(195)
    expect(out.every((i) => i.source === 'buyer-shop')).toBe(true)
  })

  it('computes facet totals matching item count', () => {
    const facets = computeCatalogFacets(all)
    expect(facets.total).toBe(all.length)
    expect(facets.sources['buyer-shop']).toBe(195)
    expect(facets.sources['t-shirts']).toBe(36)
    expect(facets.sources['merch-store']).toBe(79)
    expect(facets.availability['coming-soon']).toBe(6)
    expect(facets.availability['buyable']).toBe(304)
  })

  it('does not tag coming-soon shop items as buyable', () => {
    const soon = all.filter((i) => i.availability.includes('coming-soon'))
    expect(soon).toHaveLength(6)
    expect(soon.every((i) => !i.availability.includes('buyable'))).toBe(true)
  })

  it('matches color filter case-insensitively', () => {
    const sample = shop.find((i) => i.colors.some((c) => c.toLowerCase() === 'black'))
    expect(sample).toBeTruthy()
    const state = parseCatalogFilterSearchParams(new URLSearchParams('col=black'), 'shop')
    expect(matchesCatalogFilter(sample!, state)).toBe(true)
  })

  it('name sort orders alphabetically', () => {
    const subset = shop.slice(0, 20)
    const sorted = sortCatalogItems(subset, 'name-asc')
    const names = sorted.map((i) => i.sortName)
    expect([...names].sort((a, b) => a.localeCompare(b))).toEqual(names)
  })
})
