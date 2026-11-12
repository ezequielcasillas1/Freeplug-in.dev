import { describe, expect, it } from 'vitest'
import {
  listPublicShirtProducts,
  shirtDefaultSelectedColor,
  shirtListCardFrontMockup,
} from '@/lib/merch/shirts/catalog'
import { shirtGarmentDisplayMockupSrc } from '@/lib/merch/shirts/shirt-display-mockup'
import { isSupremeStyleShirtSlug } from '@/lib/merch/shirts/supreme-preview'

describe('shirt display mockup (grid vs PDP)', () => {
  const products = listPublicShirtProducts()

  it.each(products.map((p) => [p.slug] as const))('grid card image src matches PDP front for %s', (slug) => {
    const color = shirtDefaultSelectedColor(slug)
    const grid = shirtListCardFrontMockup({ slug })
    const pdp = shirtGarmentDisplayMockupSrc(slug, color, 'front')
    expect(grid.src).toBe(pdp)
    expect(grid.color).toBe(color)
  })

  it('init/world rectangular tees use baked *-front.jpg (live PDP parity)', () => {
    for (const p of products) {
      if (!isSupremeStyleShirtSlug(p.slug)) continue
      const src = shirtGarmentDisplayMockupSrc(p.slug, shirtDefaultSelectedColor(p.slug), 'front')
      expect(src).toMatch(/-front\.jpg$/)
      expect(src).not.toContain('-blank-front')
    }
  })

  it('grid list color matches PDP default color per slug', () => {
    for (const p of products) {
      const grid = shirtListCardFrontMockup({ slug: p.slug })
      expect(grid.color).toBe(shirtDefaultSelectedColor(p.slug))
    }
  })
})
