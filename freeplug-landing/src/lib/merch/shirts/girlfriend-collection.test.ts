import { describe, expect, it } from 'vitest'
import {
  GIRLFRIEND_DESIGN_IDS,
  girlfriendCollectionColorsForGarment,
  girlfriendCollectionMockupPublicPath,
  girlfriendCollectionUnitPriceCents,
  getGirlfriendCollectionCatalog,
  getGirlfriendDesignById,
  resolveGirlfriendPrintifyVariantId,
  validateGirlfriendCheckoutLine,
} from './girlfriend-collection'
import { getShirtBySlug } from './catalog'

const GILDAN_VARIANTS = getShirtBySlug('36-stand-144000-crest')!.variants

describe('girlfriend collection catalog', () => {
  it('lists seven designs with Printify product ids and Gildan 64000 variants', () => {
    const c = getGirlfriendCollectionCatalog()
    expect(c.designs).toHaveLength(7)
    expect(GIRLFRIEND_DESIGN_IDS).toHaveLength(7)
    expect(c.checkoutEnabled).toBe(true)
    for (const d of c.designs) {
      expect(d.printify_product_id).toMatch(/^[a-f0-9]{24}$/)
      expect(d.variants).toEqual(GILDAN_VARIANTS)
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

  it('resolves design + size + color to Printify product and variant', () => {
    const design = getGirlfriendDesignById('03-deadlines-deeds')!
    expect(resolveGirlfriendPrintifyVariantId(design, 'L', 'Natural')).toBe(63303)
    const v = validateGirlfriendCheckoutLine({
      design: '03-deadlines-deeds',
      color: 'Natural',
      size: 'L',
      quantity: 1,
    })
    expect(v.ok).toBe(true)
    if (v.ok) {
      expect(v.line.printifyProductId).toBe('6af60bdefbfb73378d08d093')
      expect(v.line.printifyVariantId).toBe(63303)
      expect(v.line.designId).toBe('03-deadlines-deeds')
      expect(v.line.unitAmountCents).toBe(1599)
    }
  })

  it('rejects unknown design and invalid combinations', () => {
    expect(validateGirlfriendCheckoutLine({ design: '99-x', color: 'Black', size: 'M', quantity: 1 }).ok).toBe(false)
    const design = getGirlfriendDesignById('01-no-time')!
    expect(resolveGirlfriendPrintifyVariantId(design, 'M', 'White')).toBe(38177)
  })

  it('covers each design id with black M variant resolution', () => {
    for (const id of GIRLFRIEND_DESIGN_IDS) {
      const design = getGirlfriendDesignById(id)!
      expect(resolveGirlfriendPrintifyVariantId(design, 'M', 'Black')).toBe(38178)
      const v = validateGirlfriendCheckoutLine({ design: id, color: 'Black', size: 'M', quantity: 1 })
      expect(v.ok).toBe(true)
    }
  })
})
