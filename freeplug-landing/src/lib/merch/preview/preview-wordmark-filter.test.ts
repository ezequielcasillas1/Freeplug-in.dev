import { describe, expect, it } from 'vitest'
import { listAllMerchItems } from '@/lib/merch/all-merch'
import { applyCatalogFilters } from '@/lib/merch/catalog-filter-logic'
import { EMPTY_CATALOG_FILTER } from '@/lib/merch/catalog-filter-types'
import {
  computePreviewWordmarkFacets,
  matchesPreviewWordmarkCatalogFilters,
  previewStyleGroupForItem,
} from './preview-wordmark-filter'
import { styleGroupForTreatment } from './wordmark-style-groups'

describe('preview wordmark catalog filters', () => {
  const all = listAllMerchItems()

  it('maps treatments to stable style groups', () => {
    expect(styleGroupForTreatment('red-box-script')).toBe('script')
    expect(styleGroupForTreatment('stamp-badge')).toBe('stamp')
    expect(styleGroupForTreatment('stacked-two-line')).toBe('stacked')
  })

  it('rectangular style filter matches no items when designed products skip overlays', () => {
    const facets = computePreviewWordmarkFacets(all)
    expect(facets.rectangularStyle).toBe(0)
    const state = { ...EMPTY_CATALOG_FILTER, rectangularStyleOnly: true }
    const out = applyCatalogFilters(all, state)
    expect(out.length).toBe(0)
    const verse = all.find((i) => i.key === 'tshirts/07-verse-psalm-82-3')
    expect(verse).toBeDefined()
    expect(matchesPreviewWordmarkCatalogFilters(verse!, true, [], [])).toBe(false)
    const shop = all.find((i) => i.source === 'buyer-shop')
    expect(shop).toBeDefined()
    expect(matchesPreviewWordmarkCatalogFilters(shop!, true, [], [])).toBe(false)
  })

  it('preview wordmark name and style facets are zero without plain-garment overlays', () => {
    const facets = computePreviewWordmarkFacets(all)
    expect(facets.rectangularStyle).toBe(0)
    expect(Object.values(facets.brandNames).every((n) => n === 0)).toBe(true)
    expect(Object.values(facets.styles).every((n) => n === 0)).toBe(true)
    expect(previewStyleGroupForItem(all[0]!)).toBeNull()
    expect(
      applyCatalogFilters(all, {
        ...EMPTY_CATALOG_FILTER,
        brandNameKeys: ['freeplug'],
        wordmarkStyleGroups: ['box'],
      }).length
    ).toBe(0)
  })
})
