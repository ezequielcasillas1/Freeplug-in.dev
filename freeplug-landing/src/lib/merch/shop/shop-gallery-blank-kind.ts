import type { ShopCatalogItem } from './types'
import { classifyBlankColor, type BlankKind } from './contrast'
import { shopGalleryIndexWithPrintablePlacement } from './shop-gallery-placement'

/** Parse `…/blanks/49-1.webp` → slide index, else null. */
export function shopBlankGalleryIndexFromSrc(src: string): number | null {
  const m = /\/blanks\/\d+-(\d+)\.\w+$/i.exec(src)
  if (!m) return null
  const idx = Number(m[1])
  return Number.isFinite(idx) ? idx : null
}

export function galleryIndexForSrc(
  item: Pick<ShopCatalogItem, 'gallery' | 'galleryBlankKinds'>,
  src: string | null | undefined
): number {
  if (!src) return 0
  const idx = item.gallery.indexOf(src)
  if (idx >= 0) return idx
  const parsed = shopBlankGalleryIndexFromSrc(src)
  return parsed ?? 0
}

/** Blank garment kind for one gallery slide (from build-time image analysis). */
export function blankKindForGallerySlide(
  item: Pick<ShopCatalogItem, 'gallery' | 'galleryBlankKinds'>,
  galleryIndex: number
): BlankKind | null {
  const kinds = item.galleryBlankKinds
  if (!kinds?.length || galleryIndex < 0 || galleryIndex >= kinds.length) return null
  return kinds[galleryIndex] ?? null
}

export function blankKindForShopBlankSrc(
  item: Pick<ShopCatalogItem, 'gallery' | 'galleryBlankKinds'>,
  src: string
): BlankKind | null {
  const idx = galleryIndexForSrc({ gallery: item.gallery, galleryBlankKinds: item.galleryBlankKinds }, src)
  return blankKindForGallerySlide(item, idx)
}

/** Blank kind for a catalog color row (variant metadata wins over name heuristics). */
export function blankKindForCatalogColor(
  item: Partial<Pick<ShopCatalogItem, 'variants'>>,
  garmentColor: string | null | undefined
): BlankKind {
  if (garmentColor && item.variants?.length) {
    const variant = item.variants.find((v) => v.color === garmentColor)
    if (variant?.blankKind) return variant.blankKind
  }
  return classifyBlankColor(garmentColor)
}

/** Pick the slide whose analyzed blank kind matches the target color (e.g. Black → dark hoodie photo). */
export function shopGalleryIndexForColor(item: ShopCatalogItem, garmentColor: string | null | undefined): number {
  const target = blankKindForCatalogColor(item, garmentColor)
  const kinds = item.galleryBlankKinds
  let preferred = 0
  if (kinds?.length) {
    const exact = kinds.findIndex((k) => k === target)
    if (exact >= 0) preferred = exact
    else if (kinds.length >= 2 && kinds.every((k) => k === kinds[0])) {
      preferred = target === 'dark' ? kinds.length - 1 : 0
    }
  } else if (item.gallery.length < 2) preferred = 0
  else preferred = target === 'dark' ? 1 : 0
  return shopGalleryIndexWithPrintablePlacement(item.slug, item.gallery.length, preferred)
}

export function shopGalleryIndexForBlankKind(item: ShopCatalogItem, blankKind: BlankKind): number {
  return shopGalleryIndexForColor(item, blankKind === 'dark' ? 'Black' : 'White')
}

const HERO_COLOR_PRIORITY = ['sand', 'natural', 'arctic white', 'white', 'ash', 'athletic heather']

/** Prefer a catalog color that matches the hero slide's blank kind. */
export function shopHeroGalleryIndex(item: ShopCatalogItem): number {
  const color = shopDefaultPreviewColor(item)
  return shopGalleryIndexForColor(item, color)
}

export function shopHeroImageSrc(item: ShopCatalogItem): string {
  const idx = shopHeroGalleryIndex(item)
  return item.gallery[idx] ?? item.gridImage
}

export function shopDefaultPreviewColor(item: ShopCatalogItem): string | null {
  const heroIdx = galleryIndexForSrc(item, item.gridImage)
  const heroKind = blankKindForGallerySlide(item, heroIdx) ?? blankKindForShopBlankSrc(item, item.gridImage)
  if (heroKind && item.colors.length) {
    for (const hint of HERO_COLOR_PRIORITY) {
      const hit = item.colors.find((c) => c.toLowerCase().includes(hint))
      if (hit && classifyBlankColor(hit) === heroKind) return hit
    }
    const match = item.variants.find((v) => v.color && v.blankKind === heroKind)
    if (match?.color) return match.color
    const byClassify = item.colors.find((c) => classifyBlankColor(c) === heroKind)
    if (byClassify) return byClassify
  }
  return item.colors[0] ?? item.variants[0]?.color ?? null
}

export function resolveShopPreviewBlankKind(opts: {
  item?: (Pick<ShopCatalogItem, 'gallery' | 'galleryBlankKinds'> & Partial<Pick<ShopCatalogItem, 'variants'>>) | null
  garmentColor?: string | null
  variantBlankKind?: BlankKind | null
  displayImageSrc?: string | null
  galleryIndex?: number
}): BlankKind {
  if (opts.item) {
    if (opts.displayImageSrc) {
      const fromSrc = blankKindForShopBlankSrc(opts.item, opts.displayImageSrc)
      if (fromSrc) return fromSrc
    }
    if (opts.galleryIndex != null) {
      const fromIdx = blankKindForGallerySlide(opts.item, opts.galleryIndex)
      if (fromIdx) return fromIdx
    }
  }
  if (opts.variantBlankKind) return opts.variantBlankKind
  if (opts.item?.variants && opts.item.variants.length > 0) {
    return blankKindForCatalogColor({ variants: opts.item.variants }, opts.garmentColor)
  }
  return classifyBlankColor(opts.garmentColor)
}

/** @deprecated Use `blankKindForShopBlankSrc(item, src)` */
export function assumedShopGalleryLengthFromSrc(_src: string): number {
  return 2
}
