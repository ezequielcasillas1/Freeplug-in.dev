import { describe, expect, it } from 'vitest'
import { catalogShirtSkipsPreviewWordmarkOverlay, isPlainCatalogGarment } from './preview-overlay-eligibility'

describe('preview overlay eligibility', () => {
  it('treats the t-shirts catalog as designed (no overlay)', () => {
    expect(catalogShirtSkipsPreviewWordmarkOverlay('t-shirts')).toBe(true)
    expect(catalogShirtSkipsPreviewWordmarkOverlay('buyer-shop')).toBe(false)
  })

  it('does not treat shop or merch-store items as plain garments (designed product art)', () => {
    expect(isPlainCatalogGarment('buyer-shop')).toBe(false)
    expect(isPlainCatalogGarment('merch-store')).toBe(false)
    expect(isPlainCatalogGarment('t-shirts')).toBe(false)
    expect(isPlainCatalogGarment(null)).toBe(false)
  })
})
