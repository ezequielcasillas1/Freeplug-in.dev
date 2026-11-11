import { describe, expect, it } from 'vitest'
import { catalogShirtSkipsPreviewWordmarkOverlay, isPlainCatalogGarment } from './preview-overlay-eligibility'

describe('preview overlay eligibility', () => {
  it('treats the t-shirts catalog as designed (no overlay)', () => {
    expect(catalogShirtSkipsPreviewWordmarkOverlay('t-shirts')).toBe(true)
    expect(catalogShirtSkipsPreviewWordmarkOverlay('buyer-shop')).toBe(false)
  })

  it('allows overlays only on plain shop and merch-store garments', () => {
    expect(isPlainCatalogGarment('buyer-shop')).toBe(true)
    expect(isPlainCatalogGarment('merch-store')).toBe(true)
    expect(isPlainCatalogGarment('t-shirts')).toBe(false)
    expect(isPlainCatalogGarment(null)).toBe(false)
  })
})
