import { describe, expect, it } from 'vitest'
import catalog from './shop-catalog.json'
import { resolveShopGalleryPlacement } from './shop-gallery-placement'
import { gridMarkWidthPx, MIN_GRID_MARK_WIDTH_PX } from './shop-placement-guards'
import { shopHeroGalleryIndex } from './shop-gallery-blank-kind'
import type { ShopCatalogItem } from './types'

const items = (catalog as { items: ShopCatalogItem[] }).items

describe('grid mark readability', () => {
  it.each(['posicharge-competitor-short-4127', 'snapback-trucker-cap-1446'] as const)(
    '%s hero width clears grid minimum',
    (slug) => {
    const item = items.find((i) => i.slug === slug)!
    const hero = shopHeroGalleryIndex(item)
    const p = resolveShopGalleryPlacement({
      slug,
      productType: item.productType,
      catalogKey: `shop/${slug}`,
      galleryIndex: hero,
      galleryLength: item.gallery.length,
    })
    expect(p).not.toBeNull()
    expect(gridMarkWidthPx(p!)).toBeGreaterThanOrEqual(MIN_GRID_MARK_WIDTH_PX)
    expect(p!.width).toBeGreaterThanOrEqual(0.26)
  })
})
