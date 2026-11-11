import { describe, expect, it } from 'vitest'
import { listShopFilterItems } from './shop-filter-items'
import { shopBrandedListingImage } from './shop-listing-image'
import { listShopItems } from './catalog'
import { shopItemMissingMockup } from './shop-public-grid'

describe('listShopFilterItems images', () => {
  it('uses Printify listing mockups for grid cards when available (not raw blank WebPs)', () => {
    const items = listShopFilterItems()
    const catalog = listShopItems()
    expect(items).toHaveLength(195)

    let printifyCard = 0
    let blankOnlyCard = 0
    for (const row of items) {
      const slug = row.key.replace(/^shop\//, '')
      const raw = catalog.find((c) => c.slug === slug)
      expect(raw).toBeTruthy()
      const branded = shopBrandedListingImage(slug)
      if (branded) {
        expect(row.image).toBe(branded)
        expect(row.image).toMatch(/^https:\/\/images-api\.printify\.com\//)
        printifyCard += 1
      } else {
        expect(row.image).toBe(raw!.gridImage)
        blankOnlyCard += 1
      }
    }
    expect(printifyCard).toBe(188)
    expect(blankOnlyCard).toBe(7)
  })

  it('keeps missing-mockup rows on blank grid images only', () => {
    const missing = listShopFilterItems().filter(shopItemMissingMockup)
    expect(missing).toHaveLength(7)
    for (const row of missing) {
      expect(row.image.startsWith('/merch/shop/')).toBe(true)
      expect(row.image).not.toMatch(/^https:\/\//)
    }
  })
})
