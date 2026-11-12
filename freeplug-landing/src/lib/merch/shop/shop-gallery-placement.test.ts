import { describe, expect, it } from 'vitest'
import { resolveShopGalleryPlacement } from './shop-gallery-placement'

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

describe('shopGalleryPlacement', () => {
  it.each(CHEKE_SLUGS)('%s has a placement entry on slide 0', (slug) => {
    const p = resolveShopGalleryPlacement({
      slug,
      productType: null,
      catalogKey: `shop/${slug}`,
      galleryIndex: 0,
      galleryLength: 2,
    })
    expect(p).not.toBeNull()
    expect(p!.left).toBeGreaterThan(0.2)
    expect(p!.left).toBeLessThan(0.8)
    expect(p!.width).toBeGreaterThan(0.09)
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
    expect(p!.width).toBeLessThanOrEqual(0.16)
    expect(p!.left).toBeLessThan(0.48)
  })

  it('zip tote clears zipper band (lower canvas)', () => {
    const p = resolveShopGalleryPlacement({
      slug: 'zippered-canvas-tote-1990',
      productType: 'bag',
      catalogKey: 'shop/zippered-canvas-tote-1990',
      galleryIndex: 0,
      galleryLength: 2,
    })
    expect(p!.top).toBeGreaterThan(0.62)
  })

  it('leather-patch dad hat uses patch ink', () => {
    const p = resolveShopGalleryPlacement({
      slug: 'dad-hat-with-leather-patch-rectangle-1221',
      productType: 'hat',
      catalogKey: 'shop/dad-hat-with-leather-patch-rectangle-1221',
      galleryIndex: 0,
      galleryLength: 2,
    })
    expect(p!.top).toBeGreaterThan(0.3)
    expect(p!.top).toBeLessThan(0.36)
    expect(p!.width).toBeLessThanOrEqual(0.11)
    expect(p!.inkBlankKind).toBe('dark')
  })

  it('beanie embroidery targets cuff band', () => {
    const p = resolveShopGalleryPlacement({
      slug: 'classic-cuffed-beanie-embroidery-1691',
      productType: 'hat',
      catalogKey: 'shop/classic-cuffed-beanie-embroidery-1691',
      galleryIndex: 0,
      galleryLength: 2,
    })
    expect(p!.top).toBeGreaterThan(0.3)
    expect(p!.top).toBeLessThan(0.38)
  })
})
