import placementsDoc from '@/lib/merch/shop/shop-gallery-placements.json'
import type { PreviewPlacement } from '@/lib/merch/preview/placement-defaults'
import {
  inferProductTypeFromCatalog,
  placementForProductType,
} from '@/lib/merch/preview/placement-defaults'
import type { ShopCatalogItem, ShopPrintArea } from './types'

export type ShopGallerySlidePlacement = PreviewPlacement & {
  /** When true, do not draw preview wordmark on this slide. */
  hide?: boolean
}

type PlacementsFile = {
  version: number
  bySlug: Record<string, { slides: ShopGallerySlidePlacement[] }>
}

const PLACEMENTS = placementsDoc as PlacementsFile

export function shopGalleryPlacementsForSlug(slug: string): ShopGallerySlidePlacement[] | null {
  return PLACEMENTS.bySlug[slug]?.slides ?? null
}

export function printAreaToPreviewPlacement(
  position: ShopPrintArea['position'] | undefined | null
): PreviewPlacement | null {
  if (!position) return null
  const { x, y, scale } = position
  if (typeof x !== 'number' || typeof y !== 'number' || typeof scale !== 'number') return null
  return {
    left: x,
    top: y,
    width: Math.min(0.5, Math.max(0.14, scale * 0.58)),
    scale: scale,
  }
}

function defaultPlacementForItem(
  slug: string,
  productType: string | null,
  catalogKey: string,
  printArea?: ShopPrintArea
): PreviewPlacement {
  const fromPrint = printAreaToPreviewPlacement(printArea?.position)
  if (fromPrint) return fromPrint
  const inferred = inferProductTypeFromCatalog(slug, productType, catalogKey)
  return placementForProductType(inferred)
}

export type ResolveShopGalleryPlacementInput = {
  slug: string
  productType: string | null
  catalogKey: string
  galleryIndex: number
  galleryLength: number
  printArea?: ShopPrintArea
}

/** Per-slide placement table (195 items); falls back to print-area / product type. */
export function resolveShopGalleryPlacement(
  input: ResolveShopGalleryPlacementInput
): ShopGallerySlidePlacement | null {
  const slides = shopGalleryPlacementsForSlug(input.slug)
  const slide =
    slides && input.galleryIndex >= 0 && input.galleryIndex < slides.length
      ? slides[input.galleryIndex]
      : undefined

  if (slide?.hide) return null

  if (slide) {
    const { hide: _hide, ...placement } = slide
    return { ...placement, hide: undefined }
  }

  return defaultPlacementForItem(input.slug, input.productType, input.catalogKey, input.printArea)
}
