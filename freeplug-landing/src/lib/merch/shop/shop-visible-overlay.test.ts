import { describe, expect, it } from 'vitest'
import { resolvePreviewWordmark } from '@/lib/merch/preview/preview-wordmark-resolve'
import catalogDoc from '@/lib/merch/shop/shop-catalog.json'
import { listShopFilterItems } from '@/lib/merch/shop/shop-filter-items'
import { shopGridMockupPropsForItem } from '@/lib/merch/shop/shop-grid-mockup-props'
import { shopHeroGalleryIndex } from '@/lib/merch/shop/shop-gallery-blank-kind'
import type { ShopCatalogItem } from '@/lib/merch/shop/types'

const catalog = catalogDoc as { items: ShopCatalogItem[] }

describe('shop visible wordmark overlay', () => {
  it('every grid card renders exactly one preview overlay', () => {
    const missing: string[] = []
    for (const item of listShopFilterItems()) {
      const props = shopGridMockupPropsForItem(item)
      if (!props.overlay || props.overlay.mode !== 'full') {
        missing.push(item.key)
      }
    }
    expect(missing).toEqual([])
  })

  it('every PDP hero slide index renders a visible overlay', () => {
    const missing: string[] = []
    for (const item of catalog.items) {
      const galleryIndex = shopHeroGalleryIndex(item)
      const resolved = resolvePreviewWordmark({
        source: 'buyer-shop',
        slug: item.slug,
        href: `/shop/${item.slug}`,
        productType: item.productType,
        catalogKey: `shop/${item.slug}`,
        garmentColor: item.colors[0] ?? null,
        galleryIndex,
        galleryLength: item.gallery.length,
        shopPrintArea: item.printArea ?? null,
      })
      if (!resolved || resolved.mode !== 'full') {
        missing.push(item.slug)
      }
    }
    expect(missing).toEqual([])
  })

  it('leather-patch 1221 uses on-dark (light) wordmark art', () => {
    const resolved = resolvePreviewWordmark({
      source: 'buyer-shop',
      slug: 'dad-hat-with-leather-patch-rectangle-1221',
      href: '/shop/dad-hat-with-leather-patch-rectangle-1221',
      productType: 'hat',
      catalogKey: 'shop/dad-hat-with-leather-patch-rectangle-1221',
      galleryIndex: 0,
      galleryLength: 2,
    })
    expect(resolved?.mode).toBe('full')
    expect(resolved?.blankKind).toBe('dark')
  })
})
