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
    expect(styleGroupForTreatment('buyer-raster')).toBe('script')
  })

  it('rectangular style filter includes buyer-shop preview wordmarks only', () => {
    const facets = computePreviewWordmarkFacets(all)
    expect(facets.rectangularStyle).toBeGreaterThan(0)
    const state = { ...EMPTY_CATALOG_FILTER, rectangularStyleOnly: true }
    const out = applyCatalogFilters(all, state)
    expect(out.length).toBeGreaterThan(0)
    expect(out.every((item) => item.source === 'buyer-shop')).toBe(true)
    const verse = all.find((i) => i.key === 'tshirts/07-verse-psalm-82-3')
    expect(verse).toBeDefined()
    expect(matchesPreviewWordmarkCatalogFilters(verse!, true, [], [])).toBe(false)
    const shop = all.find((i) => i.source === 'buyer-shop')
    expect(shop).toBeDefined()
    expect(matchesPreviewWordmarkCatalogFilters(shop!, true, [], [])).toBe(true)
  })

  it('filters by buyer-shop name and style facets', () => {
    const facets = computePreviewWordmarkFacets(all)
    expect(facets.styles.script).toBeGreaterThan(0)
    const shop = all.find((i) => i.source === 'buyer-shop')!
    expect(previewStyleGroupForItem(shop)).toBe('script')
    expect(
      applyCatalogFilters(all, {
        ...EMPTY_CATALOG_FILTER,
        brandNameKeys: ['freeplug-dev'],
        wordmarkStyleGroups: ['script'],
      }).some((i) => i.source === 'buyer-shop')
    ).toBe(true)
  })
})
