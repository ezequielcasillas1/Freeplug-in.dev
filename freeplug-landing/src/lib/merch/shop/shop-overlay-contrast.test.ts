import { describe, expect, it } from 'vitest'
import catalogDoc from '@/lib/merch/shop/shop-catalog.json'
import type { ShopCatalogItem } from '@/lib/merch/shop/types'
import {
  MIN_CONTRAST_RATIO,
  auditAllShopOverlayContrasts,
  measureInkContrast,
} from '@/lib/merch/shop/shop-overlay-contrast'
import { resolveShopGalleryPlacement } from '@/lib/merch/shop/shop-gallery-placement'
import { shopHeroGalleryIndex } from '@/lib/merch/shop/shop-gallery-blank-kind'
import { resolvePreviewWordmark } from '@/lib/merch/preview/preview-wordmark-resolve'

const catalog = catalogDoc as { items: ShopCatalogItem[] }

describe('shop overlay contrast', () => {
  it(`default grid heroes meet ${MIN_CONTRAST_RATIO}:1 ink contrast`, async () => {
    const failures = await auditAllShopOverlayContrasts(catalog.items)
    expect(failures, failures.map((f) => `${f.slug} ${f.ratio.toFixed(2)}`).join(', ')).toEqual([])
  }, 120_000)

  it('bottle 572 uses dark ink on white body', async () => {
    const item = catalog.items.find((i) => i.slug === 'copper-vacuum-insulated-bottle-22oz-572')!
    const idx = shopHeroGalleryIndex(item)
    const placement = resolveShopGalleryPlacement({
      slug: item.slug,
      productType: item.productType,
      catalogKey: `shop/${item.slug}`,
      galleryIndex: idx,
      galleryLength: item.gallery.length,
    })!
    const preview = resolvePreviewWordmark({
      source: 'buyer-shop',
      slug: item.slug,
      href: `/shop/${item.slug}`,
      productType: item.productType,
      catalogKey: `shop/${item.slug}`,
      galleryIndex: idx,
      galleryLength: item.gallery.length,
    })!
    expect(preview.blankKind).toBe('light')
    const m = await measureInkContrast({
      imageSrc: item.gallery[idx]!,
      placement,
      blankKind: preview.blankKind,
    })
    expect(m!.ratio).toBeGreaterThanOrEqual(MIN_CONTRAST_RATIO)
  })

  it('leather-patch 2707 hero avoids lifestyle slide 0', () => {
    const item = catalog.items.find((i) => i.slug === 'mid-profile-baseball-cap-with-leather-patch-rect-2707')!
    expect(shopHeroGalleryIndex(item)).toBe(1)
    const p0 = resolveShopGalleryPlacement({
      slug: item.slug,
      productType: item.productType,
      catalogKey: `shop/${item.slug}`,
      galleryIndex: 0,
      galleryLength: 2,
    })
    expect(p0).toBeNull()
  })
})
