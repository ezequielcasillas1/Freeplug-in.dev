import { describe, expect, it } from 'vitest'
import {
  assumedShopGalleryLengthFromSrc,
  blankKindForShopBlankSrc,
  resolveShopPreviewBlankKind,
  shopGalleryIndexForBlankKind,
} from './shop-gallery-blank-kind'

describe('shop gallery blank kind', () => {
  it('maps two-slide blanks: index 0 light, index 1 dark', () => {
    expect(blankKindForShopBlankSrc('/merch/shop/blanks/49-0.webp', 2)).toBe('light')
    expect(blankKindForShopBlankSrc('/merch/shop/blanks/49-1.webp', 2)).toBe('dark')
  })

  it('syncs gallery index to blank kind', () => {
    expect(shopGalleryIndexForBlankKind('light', 2)).toBe(0)
    expect(shopGalleryIndexForBlankKind('dark', 2)).toBe(1)
  })

  it('prefers visible mockup over mismatched color label', () => {
    const kind = resolveShopPreviewBlankKind({
      garmentColor: 'Antique Cherry Red',
      variantBlankKind: 'light',
      displayImageSrc: '/merch/shop/blanks/49-0.webp',
      galleryLength: 2,
    })
    expect(kind).toBe('light')
  })

  it('infers multi-slide catalogs from grid image filename', () => {
    expect(assumedShopGalleryLengthFromSrc('/merch/shop/blanks/175-1.webp')).toBe(2)
  })
})
