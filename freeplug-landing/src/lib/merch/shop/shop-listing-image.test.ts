import { describe, expect, it } from 'vitest'
import { SHOP_FREEPLUG_COMING_SOON_SLUGS } from './printify-catalog'
import {
  isPrintifyMockupImageSrc,
  shopBrandedListingImage,
  shopListingImageSrc,
} from './shop-listing-image'
import { listShopFilterItems } from './shop-filter-items'
import { listShopItems } from './catalog'

describe('shop listing images', () => {
  it('never serves Printify mockup URLs on public listing paths', () => {
    for (const item of listShopItems()) {
      expect(shopListingImageSrc(item.slug, item.gridImage)).toBe(item.gridImage)
      expect(isPrintifyMockupImageSrc(shopListingImageSrc(item.slug, item.gridImage))).toBe(false)
      for (const src of item.gallery ?? []) {
        expect(isPrintifyMockupImageSrc(src)).toBe(false)
        expect(src.startsWith('/merch/shop/')).toBe(true)
      }
    }
  })

  it('grid filter rows use local blank heroes only', () => {
    for (const row of listShopFilterItems()) {
      expect(isPrintifyMockupImageSrc(row.image)).toBe(false)
      expect(row.image.startsWith('/merch/')).toBe(true)
    }
  })

  it('falls back to blank grid image when no mockup exists', () => {
    const item = listShopItems().find((i) => i.slug === 'natural-stone-stretch-bar-bracelet-engraving-2651')
    expect(item).toBeTruthy()
    expect(shopBrandedListingImage(item!.slug)).toBeNull()
    expect(shopListingImageSrc(item!.slug, item!.gridImage)).toBe(item!.gridImage)
  })

  it('coming-soon slugs have no branded listing image', () => {
    for (const slug of SHOP_FREEPLUG_COMING_SOON_SLUGS) {
      expect(shopBrandedListingImage(slug)).toBeNull()
    }
  })
})
