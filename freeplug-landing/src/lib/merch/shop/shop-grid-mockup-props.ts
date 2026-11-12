import type { CatalogFilterItem } from '@/lib/merch/catalog-filter-types'
import { resolvePreviewWordmark, type ResolvedPreviewWordmark } from '@/lib/merch/preview/preview-wordmark-resolve'
import { getShopItem } from '@/lib/merch/shop/catalog'
import {
  blankKindForCatalogColor,
  galleryIndexForSrc,
  resolveShopPreviewBlankKind,
  shopDefaultPreviewColor,
  shopHeroImageSrc,
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
): Pick<ShopCatalogItem, 'gallery' | 'galleryBlankKinds' | 'variants'> {
  return {
    gallery: [...(item.gallery ?? [])],
    galleryBlankKinds: item.galleryBlankKinds ? [...item.galleryBlankKinds] : undefined,
    variants: [],
  }
}

/** Blank kind for the grid hero (default preview color + visible slide). */
export function shopGridGarmentBlankKind(item: CatalogFilterItem): 'light' | 'dark' {
  const slug = slugFromCatalogKey(item.key)
  const catalogItem = getShopItem(slug)
  const previewItem = catalogItem ?? previewItemFromFilter(item)
  const imageSrc = catalogItem ? shopHeroImageSrc(catalogItem) : item.image
  const galleryIndex = galleryIndexForSrc(previewItem, imageSrc)
  const garmentColor = catalogItem
    ? shopDefaultPreviewColor(catalogItem)
    : item.colors[0] ?? null
  if (catalogItem && garmentColor) {
    const variant = catalogItem.variants.find((v) => v.color === garmentColor)
    if (variant?.blankKind) return variant.blankKind
    return blankKindForCatalogColor(catalogItem, garmentColor)
  }
  return resolveShopPreviewBlankKind({
    item: catalogItem ?? previewItem,
    garmentColor,
    displayImageSrc: imageSrc,
    galleryIndex,
  })
}

export function shopGridMockupPropsForItem(item: CatalogFilterItem): ShopGridMockupProps {
  const slug = slugFromCatalogKey(item.key)
  const catalogItem = getShopItem(slug)
  const previewItem = catalogItem ?? previewItemFromFilter(item)
  const imageSrc = catalogItem ? shopHeroImageSrc(catalogItem) : item.image
  const galleryIndex = galleryIndexForSrc(previewItem, imageSrc)
  const garmentColor = catalogItem
    ? shopDefaultPreviewColor(catalogItem)
    : item.colors[0] ?? null
  const garmentBlankKind = shopGridGarmentBlankKind(item)
  const overlay = resolvePreviewWordmark({
    source: item.source,
    slug,
    href: item.href,
    productType: item.productType,
    catalogKey: item.key,
    garmentColor,
    garmentBlankKind,
    galleryIndex,
    galleryLength: previewItem.gallery?.length ?? 1,
    shopPrintArea: catalogItem?.printArea ?? null,
  })
  const remoteImage = isRemoteShopImage(imageSrc)
  return {
    imageSrc,
    garmentBlankKind,
    overlay,
    remoteImage,
  }
}
