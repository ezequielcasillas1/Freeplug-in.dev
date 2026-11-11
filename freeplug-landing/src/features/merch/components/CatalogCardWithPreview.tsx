'use client'

import { CatalogCardImage } from '@/features/merch/components/CatalogCardImage'
import { CatalogPreviewWordmarkOverlay } from '@/features/merch/components/CatalogPreviewWordmarkOverlay'
import { MerchMockupArtboard } from '@/features/merch/components/MerchMockupArtboard'
import type { CatalogFilterItem } from '@/lib/merch/catalog-filter-types'
import { resolvePreviewWordmark } from '@/lib/merch/preview/preview-wordmark-resolve'
import { blankKindForShopBlankSrc, resolveShopPreviewBlankKind } from '@/lib/merch/shop/shop-gallery-blank-kind'

function slugFromCatalogKey(key: string): string {
  const slash = key.indexOf('/')
  return slash >= 0 ? key.slice(slash + 1) : key
}

export function CatalogCardWithPreview({
  item,
  sizes,
  showOverlay = true,
}: {
  item: CatalogFilterItem
  sizes: string
  showOverlay?: boolean
}) {
  const slug = slugFromCatalogKey(item.key)
  const shopPreviewItem =
    item.gallery?.length && item.galleryBlankKinds?.length
      ? { gallery: [...item.gallery], galleryBlankKinds: [...item.galleryBlankKinds] }
      : null
  const garmentBlankKind =
    shopPreviewItem && item.image
      ? (blankKindForShopBlankSrc(shopPreviewItem, item.image) ??
        resolveShopPreviewBlankKind({
          item: shopPreviewItem,
          garmentColor: item.colors[0] ?? null,
          displayImageSrc: item.image,
          galleryIndex: 0,
        }))
      : resolveShopPreviewBlankKind({
          garmentColor: item.colors[0] ?? null,
          displayImageSrc: item.image,
        })
  const overlay = resolvePreviewWordmark({
    source: item.source,
    slug,
    href: item.href,
    productType: item.productType,
    catalogKey: item.key,
    garmentColor: item.colors[0] ?? null,
    garmentBlankKind,
  })

  return (
    <MerchMockupArtboard
      className="absolute inset-0"
      contentInset="p-2"
      image={<CatalogCardImage src={item.image} sizes={sizes} className="object-contain" />}
      overlay={showOverlay && overlay ? <CatalogPreviewWordmarkOverlay config={overlay} /> : undefined}
    />
  )
}
