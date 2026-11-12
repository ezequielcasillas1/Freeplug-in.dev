import { describe, expect, it } from 'vitest'
import catalogDoc from '@/lib/merch/shop/shop-catalog.json'
import {
  apparelWidthWithinSpec,
  auditAllHeroPlacementGuards,
  auditHeroPlacementGuards,
  chestDefaultPlacement,
  heroSlideHasExplicitPlacement,
  MAX_MARK_SURFACE_LUM_SPLIT,
  MAX_NON_FABRIC_SURFACE_SHARE,
  MAX_SKIN_SHARE_UNDER_OVERLAY,
  markSurfaceLuminanceSplit,
  nonFabricSurfaceShareUnderPlacement,
  skinShareUnderPlacement,
} from './shop-placement-guards'
import { shopHeroGalleryIndex } from './shop-gallery-blank-kind'
import { resolveShopGalleryPlacement } from './shop-gallery-placement'
import type { ShopCatalogItem } from './types'

const catalog = catalogDoc as { items: ShopCatalogItem[] }

describe('shop placement guards', () => {
  it('leather-patch 2707 hero uses slide 1 with patch coordinates, not lifestyle slide 0', () => {
    const item = catalog.items.find((i) => i.slug === 'mid-profile-baseball-cap-with-leather-patch-rect-2707')!
    const hero = shopHeroGalleryIndex(item)
    expect(hero).toBe(1)
    const p = resolveShopGalleryPlacement({
      slug: item.slug,
      productType: item.productType,
      catalogKey: `shop/${item.slug}`,
      galleryIndex: 0,
      galleryLength: 2,
    })
    expect(p).toBeNull()
    const patch = resolveShopGalleryPlacement({
      slug: item.slug,
      productType: item.productType,
      catalogKey: `shop/${item.slug}`,
      galleryIndex: 1,
      galleryLength: 2,
    })
    expect(patch).not.toBeNull()
    expect(patch!.top).toBeLessThan(0.34)
    expect(patch!.inkBlankKind).toBe('dark')
  })

  it('cotton tote 553 mark does not span stacked bags', async () => {
    const item = catalog.items.find((i) => i.slug === 'cotton-tote-bag-553')!
    const hero = shopHeroGalleryIndex(item)
    const placement = resolveShopGalleryPlacement({
      slug: item.slug,
      productType: item.productType,
      catalogKey: `shop/${item.slug}`,
      galleryIndex: hero,
      galleryLength: item.gallery.length,
    })!
    const split = await markSurfaceLuminanceSplit(item.gallery[hero]!, placement)
    expect(split).not.toBeNull()
    expect(split!).toBeLessThanOrEqual(MAX_MARK_SURFACE_LUM_SPLIT)
  })

  it('pet tank 571 mark sits on fabric not fur', async () => {
    const item = catalog.items.find((i) => i.slug === 'pet-tank-top-571')!
    const hero = shopHeroGalleryIndex(item)
    const placement = resolveShopGalleryPlacement({
      slug: item.slug,
      productType: item.productType,
      catalogKey: `shop/${item.slug}`,
      galleryIndex: hero,
      galleryLength: item.gallery.length,
    })!
    const share = await nonFabricSurfaceShareUnderPlacement(item.gallery[hero]!, placement, { countFur: true })
    expect(share).not.toBeNull()
    expect(share!).toBeLessThanOrEqual(MAX_NON_FABRIC_SURFACE_SHARE)
  })

  it('572 mark bbox avoids high skin (not on face/bottle neighbor)', async () => {
    const item = catalog.items.find((i) => i.slug === 'copper-vacuum-insulated-bottle-22oz-572')!
    const hero = shopHeroGalleryIndex(item)
    const placement = resolveShopGalleryPlacement({
      slug: item.slug,
      productType: item.productType,
      catalogKey: `shop/${item.slug}`,
      galleryIndex: hero,
      galleryLength: item.gallery.length,
    })!
    expect(placement.width).toBeLessThanOrEqual(0.28)
    const skin = await skinShareUnderPlacement(item.gallery[hero]!, placement)
    expect(skin).not.toBeNull()
    expect(skin!).toBeLessThan(MAX_SKIN_SHARE_UNDER_OVERLAY)
  })

  it('laguna raglan tee width stays within ±10% of chest default', () => {
    const slug = 'laguna-raglan-sweatshirt-3554'
    const item = catalog.items.find((i) => i.slug === slug)!
    const placement = resolveShopGalleryPlacement({
      slug,
      productType: item.productType,
      catalogKey: `shop/${slug}`,
      galleryIndex: shopHeroGalleryIndex(item),
      galleryLength: item.gallery.length,
    })!
    const ref = chestDefaultPlacement(slug, item.productType, item.printArea).width
    expect(placement.width).toBeGreaterThanOrEqual(ref * 0.9)
    expect(placement.width).toBeLessThanOrEqual(ref * 1.1)
    expect(apparelWidthWithinSpec(slug, item.productType, placement, item.printArea)).toBe(true)
  })

  it('hero placements never bake plate wordmarkStyle (picker-only)', () => {
    for (const item of catalog.items) {
      const hero = shopHeroGalleryIndex(item)
      const slide = resolveShopGalleryPlacement({
        slug: item.slug,
        productType: item.productType,
        catalogKey: `shop/${item.slug}`,
        galleryIndex: hero,
        galleryLength: item.gallery.length,
      })
      expect(slide?.wordmarkStyle, item.slug).toBeUndefined()
    }
  })

  it('every catalog hero passes skin, contrast, width, and visibility guards', async () => {
    const failures = await auditAllHeroPlacementGuards(catalog.items)
    expect(failures, failures.join('\n')).toEqual([])
  }, 180_000)

  it('every hero slide has explicit placement or is intentionally skipped only off-hero', () => {
    const missing: string[] = []
    for (const item of catalog.items) {
      const hero = shopHeroGalleryIndex(item)
      if (!heroSlideHasExplicitPlacement(item.slug, hero)) missing.push(item.slug)
    }
    expect(missing).toEqual([])
  })
})
