import { describe, expect, it } from 'vitest'
import { listPublicShirtProducts, shirtListCardFrontMockup, shirtLeadListColor } from '@/lib/merch/shirts/catalog'
import { shirtGarmentDisplayMockupSrc, shirtUsesDesignedSvgFront } from '@/lib/merch/shirts/shirt-display-mockup'
import { isSupremeStyleShirtSlug } from '@/lib/merch/shirts/supreme-preview'

describe('shirt display mockup (grid vs PDP)', () => {
  const products = listPublicShirtProducts()

  it.each(products.map((p) => [p.slug] as const))('grid card image src matches PDP front for %s', (slug) => {
    const color = shirtLeadListColor(slug)
    const grid = shirtListCardFrontMockup({ slug })
    const pdp = shirtGarmentDisplayMockupSrc(slug, color, 'front')
    expect(grid.src).toBe(pdp)
    expect(grid.color).toBe(color)
  })

  it('uses blank-front base for init/world rectangular tees only', () => {
    for (const p of products) {
      const supreme = isSupremeStyleShirtSlug(p.slug)
      const src = shirtGarmentDisplayMockupSrc(p.slug, shirtLeadListColor(p.slug), 'front')
      if (supreme) {
        expect(src).toContain('-blank-front.jpg')
        expect(shirtUsesDesignedSvgFront(p.slug, 'front')).toBe(true)
      } else {
        expect(src).not.toContain('-blank-front.jpg')
      }
    }
  })
})
