import { describe, expect, it } from 'vitest'
import {
  GIRLFRIEND_DESIGN_IDS,
  girlfriendCollectionColorsForGarment,
  girlfriendCollectionMockupPublicPath,
  girlfriendCollectionUnitPriceCents,
  getGirlfriendCollectionCatalog,
} from './girlfriend-collection'

describe('girlfriend collection catalog', () => {
  it('lists seven designs without Printify product ids', () => {
    const c = getGirlfriendCollectionCatalog()
    expect(c.designs).toHaveLength(7)
    expect(GIRLFRIEND_DESIGN_IDS).toHaveLength(7)
    expect(c.checkoutEnabled).toBe(false)
    for (const d of c.designs) {
      expect(d.printify_product_id).toBe('')
      expect(Object.keys(d.variants)).toHaveLength(0)
    }
  })

  it('maps garment ink to allowed shirt colors', () => {
    expect(girlfriendCollectionColorsForGarment('light')).toEqual(['White', 'Natural'])
    expect(girlfriendCollectionColorsForGarment('dark')).toEqual(['Black', 'Charcoal'])
  })

  it('uses front-only tee pricing', () => {
    expect(girlfriendCollectionUnitPriceCents('M')).toBe(1599)
    expect(girlfriendCollectionUnitPriceCents('2XL')).toBe(1799)
  })

  it('builds public mockup paths', () => {
    expect(girlfriendCollectionMockupPublicPath('07-love-language', 'light')).toBe(
      '/merch/shirts/girlfriend-collection/07-love-language-light.jpg'
    )
  })
})
