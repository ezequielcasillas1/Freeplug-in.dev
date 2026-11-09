import { describe, expect, it } from 'vitest'
import { SHOP_FREEPLUG_COMING_SOON_SLUGS } from './printify-catalog'
import { shopBrandedListingImage, shopListingImageSrc } from './shop-listing-image'
import { listShopItems } from './catalog'

describe('shop listing images', () => {
  it('uses Freeplug mockups for 188 shop cards and blanks for 7', () => {
    const items = listShopItems()
    let branded = 0
    for (const item of items) {
      if (shopBrandedListingImage(item.slug)) branded += 1
    }
    expect(items.length).toBe(195)
    expect(branded).toBe(188)
    expect(items.length - branded).toBe(7)
  })

  it('falls back to blank grid image when no mockup exists', () => {
    const item = listShopItems().find((i) => i.slug === 'natural-stone-stretch-bar-bracelet-engraving-2651')
    expect(item).toBeTruthy()
    expect(shopBrandedListingImage(item!.slug)).toBeNull()
    expect(shopListingImageSrc(item!.slug, item!.gridImage)).toBe(item!.gridImage)
  })

  it('serves a Printify URL for a branded slug', () => {
    const item = listShopItems()[0]!
    const src = shopBrandedListingImage(item.slug)
    expect(src).toMatch(/^https:\/\/images-api\.printify\.com\//)
  })

  it('coming-soon slugs have no branded listing image', () => {
    for (const slug of SHOP_FREEPLUG_COMING_SOON_SLUGS) {
      expect(shopBrandedListingImage(slug)).toBeNull()
    }
  })
})
