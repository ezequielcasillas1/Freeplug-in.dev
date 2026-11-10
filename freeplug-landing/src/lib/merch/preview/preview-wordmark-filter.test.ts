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

  it('filters supreme look only to items with a preview wordmark', () => {
    const state = { ...EMPTY_CATALOG_FILTER, rectangularStyleOnly: true }
    const out = applyCatalogFilters(all, state)
    expect(out.length).toBeGreaterThan(0)
    expect(out.every((item) => matchesPreviewWordmarkCatalogFilters(item, true, [], []))).toBe(true)
    const verse = all.find((i) => i.key === 'tshirts/07-verse-psalm-82-3')
    expect(verse).toBeDefined()
    expect(matchesPreviewWordmarkCatalogFilters(verse!, true, [], [])).toBe(false)
  })

  it('filters by name and style facets on policy-approved previews', () => {
    const sample = all.find((i) => i.key === 'shop/12-solid-cuffed-beanie-5665')
    expect(sample).toBeDefined()
    const facets = computePreviewWordmarkFacets(all)
    const style = previewStyleGroupForItem(sample!)
    expect(style).toBe('wide')
    expect(facets.brandNames.freeplugin).toBe(1)
    expect(
      applyCatalogFilters(all, {
        ...EMPTY_CATALOG_FILTER,
        brandNameKeys: ['freeplugin'],
        wordmarkStyleGroups: [style!],
      })
    ).toContain(sample)
  })
})
