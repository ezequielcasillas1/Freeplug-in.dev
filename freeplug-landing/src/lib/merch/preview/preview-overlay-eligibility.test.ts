import { describe, expect, it } from 'vitest'
import {
  buyerShopUsesPreviewWordmarkOverlay,
  catalogShirtSkipsPreviewWordmarkOverlay,
  isPlainCatalogGarment,
} from './preview-overlay-eligibility'

describe('preview overlay eligibility', () => {
  it('treats the t-shirts catalog as designed (no overlay)', () => {
    expect(catalogShirtSkipsPreviewWordmarkOverlay('t-shirts')).toBe(true)
    expect(catalogShirtSkipsPreviewWordmarkOverlay('buyer-shop')).toBe(false)
  })

  it('enables buyer-shop SVG overlays while merch-store stays off (PR #62)', () => {
    expect(buyerShopUsesPreviewWordmarkOverlay('buyer-shop')).toBe(true)
    expect(buyerShopUsesPreviewWordmarkOverlay('merch-store')).toBe(false)
    expect(isPlainCatalogGarment('buyer-shop')).toBe(false)
    expect(isPlainCatalogGarment('merch-store')).toBe(false)
    expect(isPlainCatalogGarment('t-shirts')).toBe(false)
    expect(isPlainCatalogGarment(null)).toBe(false)
  })
})
