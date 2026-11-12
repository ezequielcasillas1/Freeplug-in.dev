import type { CatalogFilterItem } from '@/lib/merch/catalog-filter-types'
import { resolvePreviewWordmark, type ResolvedPreviewWordmark } from '@/lib/merch/preview/preview-wordmark-resolve'
import {
  blankKindForShopBlankSrc,
  galleryIndexForSrc,
  resolveShopPreviewBlankKind,
} from '@/lib/merch/shop/shop-gallery-blank-kind'
import { isRemoteShopImage } from '@/lib/merch/shop/shop-listing-image'
import type { ShopCatalogItem } from './types'

export type ShopGridMockupProps = {
  imageSrc: string
  garmentBlankKind: 'light' | 'dark'
  overlay: ResolvedPreviewWordmark | null
  remoteImage: boolean
}

function slugFromCatalogKey(key: string): string {
  const slash = key.indexOf('/')
  return slash >= 0 ? key.slice(slash + 1) : key
}

function previewItemFromFilter(
  item: CatalogFilterItem
): Pick<ShopCatalogItem, 'gallery' | 'galleryBlankKinds'> {
  return {
    gallery: [...(item.gallery ?? [])],
    galleryBlankKinds: item.galleryBlankKinds ? [...item.galleryBlankKinds] : undefined,
  }
}

/** Blank kind for the grid hero image (per-slide analysis from #63). */
export function shopGridGarmentBlankKind(item: CatalogFilterItem): 'light' | 'dark' {
  const previewItem = previewItemFromFilter(item)
  const galleryIndex = galleryIndexForSrc(previewItem, item.image)
  const fromSlide =
    previewItem.galleryBlankKinds?.length && galleryIndex >= 0
      ? blankKindForShopBlankSrc(previewItem, item.image)
      : null
  if (fromSlide) return fromSlide
  return resolveShopPreviewBlankKind({
    item: previewItem,
    garmentColor: item.colors[0] ?? null,
    displayImageSrc: item.image,
    galleryIndex,
  })
}

export function shopGridMockupPropsForItem(item: CatalogFilterItem): ShopGridMockupProps {
  const slug = slugFromCatalogKey(item.key)
  const garmentBlankKind = shopGridGarmentBlankKind(item)
  const overlay = resolvePreviewWordmark({
    source: item.source,
    slug,
    href: item.href,
    productType: item.productType,
    catalogKey: item.key,
    garmentColor: item.colors[0] ?? null,
    garmentBlankKind,
  })
  const remoteImage = isRemoteShopImage(item.image)
  return {
    imageSrc: item.image,
    garmentBlankKind,
    overlay,
    remoteImage,
  }
}
