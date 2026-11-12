import { describe, expect, it } from 'vitest'
import catalog from './shop-catalog.json'
import {
  blankKindForGallerySlide,
  resolveShopPreviewBlankKind,
  shopGalleryIndexForColor,
  shopHeroGalleryIndex,
} from './shop-gallery-blank-kind'
import type { ShopCatalogItem } from './types'

const HOODIE_1979: Pick<ShopCatalogItem, 'gallery' | 'galleryBlankKinds'> = {
  gallery: ['/merch/shop/blanks/1979-0.webp', '/merch/shop/blanks/1979-1.webp'],
  galleryBlankKinds: ['dark', 'light'],
}

describe('shop gallery blank kind', () => {
  it('maps per-product slide kinds from catalog analysis', () => {
    expect(blankKindForGallerySlide(HOODIE_1979, 0)).toBe('dark')
    expect(blankKindForGallerySlide(HOODIE_1979, 1)).toBe('light')
  })

  it('selects dark slide for Black on hoodie 1979', () => {
    const idx = shopGalleryIndexForColor(
      { gallery: HOODIE_1979.gallery, galleryBlankKinds: HOODIE_1979.galleryBlankKinds } as ShopCatalogItem,
      'Black'
    )
    expect(idx).toBe(0)
  })

  it('inks from displayed slide, not color label alone', () => {
    const kind = resolveShopPreviewBlankKind({
      item: HOODIE_1979,
      garmentColor: 'Black',
      displayImageSrc: '/merch/shop/blanks/1979-0.webp',
      galleryIndex: 0,
    })
    expect(kind).toBe('dark')
  })

  it('never surfaces cotton tote 553-1 (baked HI lifestyle slide)', () => {
    const item = catalog.items.find((i) => i.slug === 'cotton-tote-bag-553') as ShopCatalogItem
    expect(shopHeroGalleryIndex(item)).toBe(0)
    expect(shopGalleryIndexForColor(item, 'Black')).toBe(0)
    expect(item.gallery[shopHeroGalleryIndex(item)]).toMatch(/553-0\.webp$/)
    expect(item.gallery[shopGalleryIndexForColor(item, 'Cream')]).toMatch(/553-0\.webp$/)
  })
})
