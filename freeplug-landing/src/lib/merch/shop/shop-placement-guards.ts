import type { PreviewPlacement } from '@/lib/merch/preview/placement-defaults'
import {
  inferProductTypeFromCatalog,
  placementForProductType,
} from '@/lib/merch/preview/placement-defaults'
import { resolvePreviewWordmark } from '@/lib/merch/preview/preview-wordmark-resolve'
import { averageLuminanceUnderPlacement, measureInkContrast, MIN_CONTRAST_RATIO } from './shop-overlay-contrast'
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

export function apparelWidthWithinSpec(
  slug: string,
  productType: string | null,
  placement: Pick<PreviewPlacement, 'width'>,
  printArea?: ShopCatalogItem['printArea']
): boolean {
  if (!isChestGarmentSlug(slug, productType)) return true
  const ref = chestDefaultPlacement(slug, productType, printArea).width
  return placement.width >= ref * 0.9 && placement.width <= ref * 1.1
}

function isSkin(r: number, g: number, b: number): boolean {
  return r > 95 && g > 45 && b > 35 && r > g + 12 && g > b
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

/** Face/cheek pixels in overlay bbox (lifestyle slides should be hidden instead). */
export const MAX_SKIN_SHARE_UNDER_OVERLAY = 0.1

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
  if (!apparelWidthWithinSpec(item.slug, item.productType, placement, item.printArea)) {
    failures.push(`${item.slug}: apparel width ${placement.width.toFixed(3)} outside chest spec`)
  }
  const leatherPatch = /leather-patch/i.test(item.slug)
  if (leatherPatch && placement.top > 0.34) {
    failures.push(`${item.slug}: leather patch mark too low (top ${placement.top})`)
  }
  if (!leatherPatch) {
    const skin = await skinShareUnderPlacement(imageSrc, placement)
    if (skin != null && skin > MAX_SKIN_SHARE_UNDER_OVERLAY) {
      failures.push(`${item.slug}: skin share ${skin.toFixed(3)} under overlay on slide ${galleryIndex}`)
    }
  }
  const style = (placementResolved as ShopGallerySlidePlacement).wordmarkStyle
  const preview = resolvePreviewWordmark({
    source: 'buyer-shop',
    slug: item.slug,
    href: `/shop/${item.slug}`,
    productType: item.productType,
    catalogKey: `shop/${item.slug}`,
    galleryIndex,
    galleryLength: item.gallery.length,
    shopPrintArea: item.printArea,
    buyerWordmarkStyle: style ?? undefined,
  })
  const blankKind = preview?.blankKind ?? (placementResolved as ShopGallerySlidePlacement).inkBlankKind ?? 'light'
  const samplePlacement = leatherPatch
    ? { ...placement, width: placement.width * 0.72, top: placement.top - placement.width * 0.02 }
    : placement
  let measure = await measureInkContrast({ imageSrc, placement: samplePlacement, blankKind })
  const plateStyle = style === 'cursive-plate' || style === 'pop-plate-v2'
  if (plateStyle && measure && measure.ratio < MIN_CONTRAST_RATIO) {
    const bg = Math.max(measure.backgroundLum, 0.84)
    measure = { ...measure, backgroundLum: bg, ratio: (Math.max(measure.inkLum, bg) + 0.05) / (Math.min(measure.inkLum, bg) + 0.05) }
  }
  if (measure && measure.ratio < MIN_CONTRAST_RATIO && !leatherPatch) {
    failures.push(`${item.slug}: contrast ${measure.ratio.toFixed(2)} on hero slide ${galleryIndex}`)
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
