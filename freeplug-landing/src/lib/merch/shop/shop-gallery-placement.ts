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
  /** Ink follows patch / embroidery surface, not whole garment. */
  inkBlankKind?: 'light' | 'dark'
}

type PlacementsFile = {
  version: number
  bySlug: Record<string, { slides: ShopGallerySlidePlacement[] }>
}

const PLACEMENTS = placementsDoc as PlacementsFile

export function shopGalleryPlacementsForSlug(slug: string): ShopGallerySlidePlacement[] | null {
  return PLACEMENTS.bySlug[slug]?.slides ?? null
}

export function isShopGallerySlideHidden(slug: string, galleryIndex: number): boolean {
  const slides = shopGalleryPlacementsForSlug(slug)
  if (!slides || galleryIndex < 0 || galleryIndex >= slides.length) return false
  return Boolean(slides[galleryIndex]?.hide)
}

/** Prefer `preferredIndex` when visible; otherwise first slide with a printable placement. */
export function shopBuyerVisibleGalleryIndex(
  slug: string,
  galleryLength: number,
  preferredIndex: number
): number {
  const slides = shopGalleryPlacementsForSlug(slug)
  if (!slides?.length) return Math.min(Math.max(0, preferredIndex), Math.max(0, galleryLength - 1))
  if (
    preferredIndex >= 0 &&
    preferredIndex < galleryLength &&
    slides[preferredIndex] &&
    !slides[preferredIndex].hide
  ) {
    return preferredIndex
  }
  for (let i = 0; i < galleryLength; i++) {
    if (slides[i] && !slides[i].hide) return i
  }
  return Math.min(Math.max(0, preferredIndex), Math.max(0, galleryLength - 1))
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

  if (slide?.hide) {
    return defaultPlacementForItem(input.slug, input.productType, input.catalogKey, input.printArea)
  }

  if (slide) {
    const { hide: _hide, ...rest } = slide
    return rest
  }

  return defaultPlacementForItem(input.slug, input.productType, input.catalogKey, input.printArea)
}
