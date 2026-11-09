import { describe, expect, it } from 'vitest'
import {
  CATALOG_SIZE_FACET_ONE_SIZE,
  normalizeSizeFacetKey,
  sizeFacetFilterMatches,
  uniqueSizeFacetKeys,
} from './catalog-size-facet'

describe('catalog size facets', () => {
  it('collapses one-size aliases', () => {
    for (const raw of ['One size', 'one-size', 'OSFA', 'O/S', 'ONE SIZE FITS ALL']) {
      expect(normalizeSizeFacetKey(raw)).toBe(CATALOG_SIZE_FACET_ONE_SIZE)
    }
  })

  it('normalizes letter sizes and slash variants', () => {
    expect(normalizeSizeFacetKey('s/m')).toBe('S/M')
    expect(normalizeSizeFacetKey('S-M')).toBe('S/M')
    expect(normalizeSizeFacetKey('2xl')).toBe('2XL')
    expect(normalizeSizeFacetKey(' m ')).toBe('M')
  })

  it('matches filters across raw size labels', () => {
    const keys = uniqueSizeFacetKeys(['OSFA', 'M', 's-m'])
    expect(keys).toContain(CATALOG_SIZE_FACET_ONE_SIZE)
    expect(keys).toContain('S/M')
    expect(sizeFacetFilterMatches(['one-size'], [CATALOG_SIZE_FACET_ONE_SIZE])).toBe(true)
    expect(sizeFacetFilterMatches(['OSFA'], ['one-size'])).toBe(true)
  })
})
