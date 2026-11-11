import type { ShopCatalogItem } from './types'
import { classifyBlankColor, type BlankKind } from './contrast'

/** Parse `…/blanks/49-1.webp` → slide index, else null. */
export function shopBlankGalleryIndexFromSrc(src: string): number | null {
  const m = /\/blanks\/\d+-(\d+)\.\w+$/i.exec(src)
  if (!m) return null
  const idx = Number(m[1])
  return Number.isFinite(idx) ? idx : null
}

/**
 * Two-slide shop blanks are ingested as a light garment (index 0) and dark (index 1).
 * Single-slide products fall back to variant / color classification.
 */
export function blankKindForShopGalleryIndex(galleryIndex: number, galleryLength: number): BlankKind | null {
  if (galleryLength < 2) return null
  if (galleryIndex <= 0) return 'light'
  return 'dark'
}

export function blankKindForShopBlankSrc(src: string, galleryLength: number): BlankKind | null {
  const idx = shopBlankGalleryIndexFromSrc(src)
  if (idx == null) return null
  return blankKindForShopGalleryIndex(idx, galleryLength)
}

export function shopGalleryIndexForBlankKind(blankKind: BlankKind, galleryLength: number): number {
  if (galleryLength < 2) return 0
  return blankKind === 'dark' ? 1 : 0
}

/** Grid cards only ship one blank URL; infer slide count from the filename index. */
export function assumedShopGalleryLengthFromSrc(src: string): number {
  const idx = shopBlankGalleryIndexFromSrc(src)
  if (idx == null) return 1
  return Math.max(2, idx + 1)
}

const HERO_COLOR_PRIORITY = ['sand', 'natural', 'arctic white', 'white', 'ash', 'athletic heather']

/** Prefer the garment shown in the hero blank; else first catalog color. */
export function shopDefaultPreviewColor(item: ShopCatalogItem): string | null {
  const heroKind = blankKindForShopBlankSrc(item.gridImage, item.gallery.length)
  if (heroKind && item.colors.length) {
    for (const hint of HERO_COLOR_PRIORITY) {
      const hit = item.colors.find((c) => c.toLowerCase().includes(hint))
      if (hit && classifyBlankColor(hit) === heroKind) return hit
    }
    const match = item.variants.find((v) => v.color && v.blankKind === heroKind)
    if (match?.color) return match.color
  }
  return item.colors[0] ?? item.variants[0]?.color ?? null
}

export function resolveShopPreviewBlankKind(opts: {
  garmentColor?: string | null
  variantBlankKind?: BlankKind | null
  displayImageSrc?: string | null
  galleryLength?: number
}): BlankKind {
  const fromImage =
    opts.displayImageSrc && (opts.galleryLength ?? 0) > 0
      ? blankKindForShopBlankSrc(opts.displayImageSrc, opts.galleryLength!)
      : null
  if (fromImage) return fromImage
  if (opts.variantBlankKind) return opts.variantBlankKind
  return classifyBlankColor(opts.garmentColor)
}
