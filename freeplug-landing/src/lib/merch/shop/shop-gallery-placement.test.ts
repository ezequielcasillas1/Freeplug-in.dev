import { describe, expect, it } from 'vitest'
import catalog from './shop-catalog.json'
import { isShopGallerySlideHidden, resolveShopGalleryPlacement } from './shop-gallery-placement'
import { shopHeroGalleryIndex } from './shop-gallery-blank-kind'
import type { ShopCatalogItem } from './types'

const catalogItems = (catalog as { items: ShopCatalogItem[] }).items

const CHEKE_SLUGS = [
  'cotton-canvas-tote-bag-1313',
  'canvas-tote-bag-5-color-straps-507',
  'zippered-canvas-tote-1990',
  'tote-bag-aop-1389',
  'action-snapback-cap-5284',
  'dad-hat-with-leather-patch-rectangle-1221',
  'snapback-trucker-cap-1743',
  'mid-profile-baseball-cap-with-leather-patch-rect-2707',
  'classic-cuffed-beanie-embroidery-1691',
] as const

/** Rect leather patch: hide lifestyle slide 0, place on slide 1. */
const LEATHER_PATCH_LIFESTYLE_HIDDEN = new Set(['mid-profile-baseball-cap-with-leather-patch-rect-2707'])

/** Slide 0 hidden — placement on slide 1 (flat product / bag body). */
const HERO_ON_SLIDE_ONE = new Set(['zippered-canvas-tote-1990', ...LEATHER_PATCH_LIFESTYLE_HIDDEN])

describe('shopGalleryPlacement', () => {
  it.each(CHEKE_SLUGS)('%s has a printable placement on its hero slide', (slug) => {
    const galleryIndex = HERO_ON_SLIDE_ONE.has(slug) ? 1 : 0
    const p = resolveShopGalleryPlacement({
      slug,
      productType: null,
      catalogKey: `shop/${slug}`,
      galleryIndex,
      galleryLength: 2,
    })
    expect(p).not.toBeNull()
    expect(p!.left).toBeGreaterThan(0.2)
    expect(p!.left).toBeLessThan(0.8)
    const patchCap = LEATHER_PATCH_LIFESTYLE_HIDDEN.has(slug)
    expect(p!.width).toBeGreaterThan(patchCap ? 0.07 : 0.09)
  })

  it('caps place wordmark on crown (upper mockup)', () => {
    const p = resolveShopGalleryPlacement({
      slug: 'action-snapback-cap-5284',
      productType: 'hat',
      catalogKey: 'shop/action-snapback-cap-5284',
      galleryIndex: 0,
      galleryLength: 2,
    })
    expect(p!.top).toBeLessThan(0.28)
    expect(p!.width).toBeLessThan(0.26)
  })

  it('totes place wordmark on bag body (mid–lower mockup)', () => {
    const p = resolveShopGalleryPlacement({
      slug: 'cotton-canvas-tote-bag-1313',
      productType: 'bag',
      catalogKey: 'shop/cotton-canvas-tote-bag-1313',
      galleryIndex: 0,
      galleryLength: 2,
    })
    expect(p!.top).toBeGreaterThan(0.5)
    expect(p!.width).toBeLessThanOrEqual(0.17)
    expect(p!.left).toBeLessThan(0.48)
  })

  it('zip tote clears zipper band (lower canvas)', () => {
    const p = resolveShopGalleryPlacement({
      slug: 'zippered-canvas-tote-1990',
      productType: 'bag',
      catalogKey: 'shop/zippered-canvas-tote-1990',
      galleryIndex: 1,
      galleryLength: 2,
    })
    expect(p!.top).toBeGreaterThan(0.62)
  })

  it('leather-patch 2707 hides lifestyle slide 0', () => {
    const hidden = resolveShopGalleryPlacement({
      slug: 'mid-profile-baseball-cap-with-leather-patch-rect-2707',
      productType: 'hat',
      catalogKey: 'shop/mid-profile-baseball-cap-with-leather-patch-rect-2707',
      galleryIndex: 0,
      galleryLength: 2,
    })
    expect(hidden).toBeNull()
  })

  it('leather-patch dad hat centers on patch with light ink', () => {
    const p = resolveShopGalleryPlacement({
      slug: 'dad-hat-with-leather-patch-rectangle-1221',
      productType: 'hat',
      catalogKey: 'shop/dad-hat-with-leather-patch-rectangle-1221',
      galleryIndex: 0,
      galleryLength: 2,
    })
    expect(p!.left).toBeGreaterThan(0.46)
    expect(p!.left).toBeLessThan(0.54)
    expect(p!.width).toBeGreaterThanOrEqual(0.16)
    expect(p!.inkBlankKind).toBe('dark')
  })

  it('pet bandana lifestyle slide avoids upper fur', () => {
    const p = resolveShopGalleryPlacement({
      slug: 'pet-bandana-562',
      productType: 'pets',
      catalogKey: 'shop/pet-bandana-562',
      galleryIndex: 0,
      galleryLength: 2,
    })
    expect(p!.top).toBeGreaterThan(0.55)
  })

  it('beanie embroidery targets cuff band', () => {
    const p = resolveShopGalleryPlacement({
      slug: 'classic-cuffed-beanie-embroidery-1691',
      productType: 'hat',
      catalogKey: 'shop/classic-cuffed-beanie-embroidery-1691',
      galleryIndex: 0,
      galleryLength: 2,
    })
    expect(p!.top).toBeGreaterThan(0.65)
    expect(resolveShopGalleryPlacement({
      slug: 'classic-cuffed-beanie-embroidery-1691',
      productType: 'hat',
      catalogKey: 'shop/classic-cuffed-beanie-embroidery-1691',
      galleryIndex: 1,
      galleryLength: 2,
    })).toBeNull()
  })

  it('cotton tote 553 marks front green bag only', () => {
    const p = resolveShopGalleryPlacement({
      slug: 'cotton-tote-bag-553',
      productType: 'bag',
      catalogKey: 'shop/cotton-tote-bag-553',
      galleryIndex: 0,
      galleryLength: 2,
    })
    expect(p!.left).toBeGreaterThan(0.22)
    expect(p!.left).toBeLessThan(0.32)
    expect(p!.top).toBeGreaterThan(0.46)
    expect(p!.top).toBeLessThan(0.54)
    expect(p!.inkBlankKind).toBe('light')
  })

  it('cotton tote 553-1 stays hidden and is never the hero slide', () => {
    expect(isShopGallerySlideHidden('cotton-tote-bag-553', 1)).toBe(true)
    const item = catalogItems.find((i) => i.slug === 'cotton-tote-bag-553')!
    expect(shopHeroGalleryIndex(item)).toBe(0)
    expect(resolveShopGalleryPlacement({
      slug: item.slug,
      productType: item.productType,
      catalogKey: `shop/${item.slug}`,
      galleryIndex: 1,
      galleryLength: 2,
    })).toBeNull()
  })

  it('zip hoodies place mark off-center chest panel (~0.12 width)', () => {
    for (const slug of [
      'unisex-fleece-zip-up-hoodie-1925',
      'repeat-1-2-zip-long-sleeve-hooded-jacket-4397',
      'toddler-full-zip-fleece-hoodie-2728',
    ]) {
      const item = catalogItems.find((i) => i.slug === slug)!
      const hero = shopHeroGalleryIndex(item)
      const p = resolveShopGalleryPlacement({
        slug,
        productType: item.productType,
        catalogKey: `shop/${slug}`,
        galleryIndex: hero,
        galleryLength: item.gallery.length,
      })
      expect(p?.width, slug).toBeGreaterThanOrEqual(0.1)
      expect(p?.width, slug).toBeLessThanOrEqual(0.14)
      expect(p!.left, slug).toBeGreaterThan(0.52)
    }
  })
})
