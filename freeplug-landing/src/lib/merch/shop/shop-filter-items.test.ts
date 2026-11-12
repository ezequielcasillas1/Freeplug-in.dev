import { describe, expect, it } from 'vitest'
import { listShopFilterItems } from './shop-filter-items'
import { isPrintifyMockupImageSrc } from './shop-listing-image'
import { shopItemMissingMockup } from './shop-public-grid'

describe('listShopFilterItems images', () => {
  it('uses logo-free blank mockups for every grid card (no Printify baked logo)', () => {
    const items = listShopFilterItems()
    expect(items).toHaveLength(176)
    for (const row of items) {
      expect(isPrintifyMockupImageSrc(row.image)).toBe(false)
      expect(row.image).toMatch(/^\/merch\/shop\//)
    }
  })

  it('keeps missing-mockup rows on blank grid images only', () => {
    const missing = listShopFilterItems().filter(shopItemMissingMockup)
    expect(missing).toHaveLength(6)
    for (const row of missing) {
      expect(row.image.startsWith('/merch/shop/')).toBe(true)
      expect(row.image).not.toMatch(/^https:\/\//)
    }
  })
})
