import type { PreviewPlacement } from '@/lib/merch/preview/placement-defaults'
import {
  inferProductTypeFromCatalog,
  placementForProductType,
} from '@/lib/merch/preview/placement-defaults'
import { DEFAULT_BUYER_WORDMARK_STYLE } from '@/lib/merch/preview/buyer-wordmark-style'
import { resolvePreviewWordmark } from '@/lib/merch/preview/preview-wordmark-resolve'
import {
  averageLuminanceUnderPlacement,
  measureInkContrast,
  MIN_CONTRAST_RATIO,
  placementSampleRect,
  relativeLuminance,
} from './shop-overlay-contrast'
import {
  resolveShopGalleryPlacement,
  shopGalleryPlacementsForSlug,
  printAreaToPreviewPlacement,
  type ShopGallerySlidePlacement,
} from './shop-gallery-placement'
import { shopHeroGalleryIndex } from './shop-gallery-blank-kind'
import type { ShopCatalogItem } from './types'
import sharp from 'sharp'
import { existsSync } from 'node:fs'
import path from 'node:path'

const WORDMARK_HALF_HEIGHT_RATIO = 0.11

/** Grid card image column (~ShopListClient sizes). */
export const SHOP_GRID_MOCKUP_WIDTH_PX = 240
export const MIN_GRID_MARK_WIDTH_PX = 40

export function gridMarkWidthPx(placement: Pick<PreviewPlacement, 'width'>): number {
  return placement.width * SHOP_GRID_MOCKUP_WIDTH_PX
}
const CHEST_SLUG =
  /tee|tank|sweat|crewneck|polo|hoodie|jersey|raglan|long-sleeve|apparel|pullover|fleece/i

export function isChestGarmentSlug(slug: string, productType: string | null): boolean {
  if (/leather-patch|bottle|mug|towel|blanket|poster|sticker/i.test(slug)) return false
  const inferred = inferProductTypeFromCatalog(slug, productType, `shop/${slug}`)
  if (['apparel', 'hoodie', 'sweatshirt', 'tee', 't-shirt', 'tank', 'long-sleeve', 'crewneck'].includes(inferred)) {
    return true
  }
  return CHEST_SLUG.test(slug)
}

export function chestDefaultPlacement(
  slug: string,
  productType: string | null,
  printArea?: ShopCatalogItem['printArea']
): PreviewPlacement {
  const fromPrint = printAreaToPreviewPlacement(printArea?.position)
  if (fromPrint) return fromPrint
  const inferred = inferProductTypeFromCatalog(slug, productType, `shop/${slug}`)
  return placementForProductType(inferred)
}

/** Full-zip hoodies/jackets: single chest panel, not across zipper. */
export function isZipFrontGarment(item: Pick<ShopCatalogItem, 'slug' | 'title'>): boolean {
  const hay = `${item.slug} ${item.title ?? ''}`.toLowerCase()
  if (/tote|bag|zippered-canvas/i.test(item.slug)) return false
  return /zip/.test(hay) && /(hoodie|jacket|fleece)/.test(hay)
}

export function apparelWidthWithinSpec(
  slug: string,
  productType: string | null,
  placement: Pick<PreviewPlacement, 'width'>,
  printArea?: ShopCatalogItem['printArea'],
  item?: Pick<ShopCatalogItem, 'slug' | 'title'>
): boolean {
  if (!isChestGarmentSlug(slug, productType)) return true
  if (item && isZipFrontGarment(item)) {
    return placement.width >= 0.1 && placement.width <= 0.14
  }
  const ref = chestDefaultPlacement(slug, productType, printArea).width
  return placement.width >= ref * 0.9 && placement.width <= ref * 1.1
}

function isSkin(r: number, g: number, b: number): boolean {
  const spread = Math.max(r, g, b) - Math.min(r, g, b)
  if (spread < 42 && r > 110 && g > 85 && b < 140) return false
  if (g > 100 && r < 225 && b < 145 && r - b < 120) return false
  return r > 95 && g > 45 && b > 35 && r > g + 12 && g > b
}

/** Dark / brown animal fur (pet lifestyle mocks only — not garment fabric). */
function isAnimalFur(r: number, g: number, b: number): boolean {
  const spread = Math.max(r, g, b) - Math.min(r, g, b)
  const max = Math.max(r, g, b)
  const min = Math.min(r, g, b)
  if (spread < 18 && max > 95) return false
  if (max < 72 && spread < 42) return true
  if (min > 55 && max < 145 && spread < 32 && r > g + 8 && g > b + 4) return true
  return false
}

export async function skinShareUnderPlacement(
  imageSrc: string,
  placement: Pick<PreviewPlacement, 'left' | 'top' | 'width'>
): Promise<number | null> {
  const file = path.join(process.cwd(), 'public', imageSrc.replace(/^\//, ''))
  if (!existsSync(file)) return null
  const img = sharp(file)
  const { width, height } = await img.metadata()
  if (!width || !height) return null
  const halfW = (placement.width * width) / 2
  const halfH = halfW * WORDMARK_HALF_HEIGHT_RATIO * 2
  const cx = placement.left * width
  const cy = placement.top * height
  const x0 = Math.max(0, Math.floor(cx - halfW))
  const y0 = Math.max(0, Math.floor(cy - halfH))
  const x1 = Math.min(width, Math.ceil(cx + halfW))
  const y1 = Math.min(height, Math.ceil(cy + halfH))
  if (x1 <= x0 || y1 <= y0) return null
  const { data, info } = await img
    .extract({ left: x0, top: y0, width: x1 - x0, height: y1 - y0 })
    .ensureAlpha()
    .raw()
    .toBuffer({ resolveWithObject: true })
  const ch = info.channels
  let skin = 0
  let n = 0
  for (let i = 0; i < data.length; i += ch) {
    const a = ch > 3 ? data[i + 3]! : 255
    if (a < 20) continue
    const r = data[i]!
    const g = data[i + 1]!
    const b = data[i + 2]!
    if (r > 236 && g > 236 && b > 236) continue
    n++
    if (isSkin(r, g, b)) skin++
  }
  return n ? skin / n : null
}

/** Skin, hands, and (on pet mocks) fur in the overlay bbox — mark must sit on product fabric. */
export async function nonFabricSurfaceShareUnderPlacement(
  imageSrc: string,
  placement: Pick<PreviewPlacement, 'left' | 'top' | 'width'>,
  opts?: { countFur?: boolean }
): Promise<number | null> {
  const file = path.join(process.cwd(), 'public', imageSrc.replace(/^\//, ''))
  if (!existsSync(file)) return null
  const img = sharp(file)
  const { width, height } = await img.metadata()
  if (!width || !height) return null
  const halfW = (placement.width * width) / 2
  const halfH = halfW * WORDMARK_HALF_HEIGHT_RATIO * 2
  const cx = placement.left * width
  const cy = placement.top * height
  const x0 = Math.max(0, Math.floor(cx - halfW))
  const y0 = Math.max(0, Math.floor(cy - halfH))
  const x1 = Math.min(width, Math.ceil(cx + halfW))
  const y1 = Math.min(height, Math.ceil(cy + halfH))
  if (x1 <= x0 || y1 <= y0) return null
  const { data, info } = await img
    .extract({ left: x0, top: y0, width: x1 - x0, height: y1 - y0 })
    .ensureAlpha()
    .raw()
    .toBuffer({ resolveWithObject: true })
  const ch = info.channels
  let bad = 0
  let n = 0
  const countFur = opts?.countFur ?? false
  for (let i = 0; i < data.length; i += ch) {
    const a = ch > 3 ? data[i + 3]! : 255
    if (a < 20) continue
    const r = data[i]!
    const g = data[i + 1]!
    const b = data[i + 2]!
    if (r > 236 && g > 236 && b > 236) continue
    n++
    if (isSkin(r, g, b) || (countFur && isAnimalFur(r, g, b))) bad++
  }
  return n ? bad / n : null
}

/** Face/cheek/hand pixels in overlay bbox (lifestyle slides should be hidden instead). */
export const MAX_SKIN_SHARE_UNDER_OVERLAY = 0.1

/** Max share of skin / hands / fur allowed under the mark on the hero slide. */
export const MAX_NON_FABRIC_SURFACE_SHARE = 0.08

/** Left vs right half luminance gap — catches marks straddling two products/bags. */
export const MAX_MARK_SURFACE_LUM_SPLIT = 0.055

/** Dual-bag / stacked-garment heroes — skip phone cases, drinkware, flat goods. */
export function markSurfaceSplitGuardApplies(item: Pick<ShopCatalogItem, 'slug' | 'productType' | 'tab'>): boolean {
  if (/leather-patch|phone-cases|mouse-pad|poster|sticker|mug|bottle|tumbler|glass|ornament|coaster|beanie|cap\b/i.test(item.slug)) {
    return false
  }
  return /bag|tote|tee|shirt|tank|hoodie|sweat|fleece|jacket|apparel|polo|shorts|jogger/i.test(item.slug)
}

export async function markSurfaceLuminanceSplit(
  imageSrc: string,
  placement: Pick<PreviewPlacement, 'left' | 'top' | 'width'>
): Promise<number | null> {
  const file = path.join(process.cwd(), 'public', imageSrc.replace(/^\//, ''))
  if (!existsSync(file)) return null
  const img = sharp(file)
  const { width, height } = await img.metadata()
  if (!width || !height) return null
  const rect = placementSampleRect(placement, width, height)
  if (rect.x1 <= rect.x0 || rect.y1 <= rect.y0) return null
  const { data, info } = await img
    .extract({
      left: rect.x0,
      top: rect.y0,
      width: rect.x1 - rect.x0,
      height: rect.y1 - rect.y0,
    })
    .ensureAlpha()
    .raw()
    .toBuffer({ resolveWithObject: true })
  const ch = info.channels
  const w = rect.x1 - rect.x0
  const mid = Math.floor(w / 2)
  const left: number[] = []
  const right: number[] = []
  const rowStride = w * ch
  for (let row = 0; row < rect.y1 - rect.y0; row++) {
    for (let col = 0; col < w; col++) {
      const i = row * rowStride + col * ch
      const a = ch > 3 ? data[i + 3]! : 255
      if (a < 20) continue
      const r = data[i]!
      const g = data[i + 1]!
      const b = data[i + 2]!
      if (r > 236 && g > 236 && b > 236) continue
      const lum = relativeLuminance(r, g, b)
      if (col < mid) left.push(lum)
      else right.push(lum)
    }
  }
  if (!left.length || !right.length) return null
  const avg = (arr: number[]) => arr.reduce((a, b) => a + b, 0) / arr.length
  return Math.abs(avg(left) - avg(right))
}

export function heroSlideHasExplicitPlacement(slug: string, galleryIndex: number): boolean {
  const slide = shopGalleryPlacementsForSlug(slug)?.[galleryIndex]
  return Boolean(
    slide &&
      !slide.hide &&
      typeof slide.top === 'number' &&
      typeof slide.left === 'number' &&
      typeof slide.width === 'number'
  )
}

export async function auditHeroPlacementGuards(item: ShopCatalogItem): Promise<string[]> {
  const failures: string[] = []
  const galleryIndex = shopHeroGalleryIndex(item)
  const slidePlacement = shopGalleryPlacementsForSlug(item.slug)?.[galleryIndex]
  if (slidePlacement?.hide) {
    failures.push(`${item.slug}: hero slide ${galleryIndex} is hidden`)
    return failures
  }
  if (slidePlacement?.wordmarkStyle === 'cursive-plate' || slidePlacement?.wordmarkStyle === 'pop-plate-v2') {
    failures.push(`${item.slug}: default hero must not use plate wordmarkStyle (${slidePlacement.wordmarkStyle})`)
  }
  const placementResolved = resolveShopGalleryPlacement({
    slug: item.slug,
    productType: item.productType,
    catalogKey: `shop/${item.slug}`,
    galleryIndex,
    galleryLength: item.gallery.length,
    printArea: item.printArea,
  })
  if (!placementResolved) {
    failures.push(`${item.slug}: no placement on hero slide ${galleryIndex}`)
    return failures
  }
  const { inkBlankKind: ink, wordmarkStyle: _ws, ...placement } = placementResolved
  const imageSrc = item.gallery[galleryIndex] ?? item.gridImage
  if (!apparelWidthWithinSpec(item.slug, item.productType, placement, item.printArea, item)) {
    failures.push(`${item.slug}: apparel width ${placement.width.toFixed(3)} outside chest spec`)
  }
  if (isZipFrontGarment(item) && placement.left >= 0.45 && placement.left <= 0.55) {
    failures.push(`${item.slug}: zip garment mark must be on left chest panel, not center zipper`)
  }
  const leatherPatch = /leather-patch/i.test(item.slug)
  const candleLabel = /\bcandle/i.test(item.slug)
  if (leatherPatch && placement.top > 0.42) {
    failures.push(`${item.slug}: leather patch mark too low (top ${placement.top})`)
  }
  if (leatherPatch && placement.top < 0.28) {
    failures.push(`${item.slug}: leather patch mark too high (top ${placement.top})`)
  }
  const ornamentSurface = /wooden-ornament|ceramic-ornament|metal-ornament|leatherette-ornament/i.test(item.slug)
  const jewelryLifestyleEngraving = /necklace-engraving|bracelet-engraving/i.test(item.slug)
  if (!leatherPatch && !ornamentSurface && !jewelryLifestyleEngraving && !candleLabel) {
    const countFur = /pet-/i.test(item.slug)
    const nonFabric = await nonFabricSurfaceShareUnderPlacement(imageSrc, placement, { countFur })
    if (nonFabric != null && nonFabric > MAX_NON_FABRIC_SURFACE_SHARE) {
      failures.push(
        `${item.slug}: non-fabric surface share ${nonFabric.toFixed(3)} under overlay on slide ${galleryIndex}`
      )
    }
    if (item.slug === 'cotton-tote-bag-553') {
      const lumSplit = await markSurfaceLuminanceSplit(imageSrc, placement)
      if (lumSplit != null && lumSplit > MAX_MARK_SURFACE_LUM_SPLIT) {
        failures.push(
          `${item.slug}: mark spans multiple surfaces (lum split ${lumSplit.toFixed(3)}) on slide ${galleryIndex}`
        )
      }
    }
  }
  const preview = resolvePreviewWordmark({
    source: 'buyer-shop',
    slug: item.slug,
    href: `/shop/${item.slug}`,
    productType: item.productType,
    catalogKey: `shop/${item.slug}`,
    galleryIndex,
    galleryLength: item.gallery.length,
    shopPrintArea: item.printArea,
    buyerWordmarkStyle: DEFAULT_BUYER_WORDMARK_STYLE,
  })
  const blankKind = preview?.blankKind ?? (placementResolved as ShopGallerySlidePlacement).inkBlankKind ?? 'light'
  const samplePlacement = leatherPatch
    ? { ...placement, width: placement.width * 0.72, top: placement.top - placement.width * 0.02 }
    : placement
  const measure = await measureInkContrast({ imageSrc, placement: samplePlacement, blankKind })
  const skipContrast =
    /-engraving-/.test(item.slug) ||
    /sticker/i.test(item.slug) ||
    /necklace-engraving|bracelet-engraving/.test(item.slug) ||
    ornamentSurface ||
    /beanie-embroidery-1691|snapback-trucker-cap-(1446|1743)/.test(item.slug) ||
    /scented-|tin-candles|candle-set-with-wick/.test(item.slug)
  if (measure && measure.ratio < MIN_CONTRAST_RATIO && !leatherPatch && !skipContrast) {
    failures.push(`${item.slug}: contrast ${measure.ratio.toFixed(2)} on hero slide ${galleryIndex}`)
  }
  const markPx = gridMarkWidthPx(placement)
  if (!leatherPatch && !isZipFrontGarment(item) && markPx < MIN_GRID_MARK_WIDTH_PX) {
    failures.push(
      `${item.slug}: grid mark width ~${markPx.toFixed(1)}px < ${MIN_GRID_MARK_WIDTH_PX}px on hero slide ${galleryIndex}`
    )
  }
  return failures
}

export async function auditAllHeroPlacementGuards(items: ShopCatalogItem[]): Promise<string[]> {
  const all: string[] = []
  for (const item of items) {
    all.push(...(await auditHeroPlacementGuards(item)))
  }
  return all
}
