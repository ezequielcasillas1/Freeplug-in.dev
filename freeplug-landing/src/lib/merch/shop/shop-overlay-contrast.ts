import { existsSync } from 'node:fs'
import path from 'node:path'
import sharp from 'sharp'
import type { PreviewPlacement } from '@/lib/merch/preview/placement-defaults'
import { DEFAULT_BUYER_WORDMARK_STYLE } from '@/lib/merch/preview/buyer-wordmark-style'
import { resolvePreviewWordmark } from '@/lib/merch/preview/preview-wordmark-resolve'
import { shopHeroGalleryIndex } from '@/lib/merch/shop/shop-gallery-blank-kind'
import { resolveShopGalleryPlacement } from '@/lib/merch/shop/shop-gallery-placement'
import type { ShopCatalogItem } from '@/lib/merch/shop/types'

const WORDMARK_HALF_HEIGHT_RATIO = 0.11
const MIN_CONTRAST_RATIO = 3

export function relativeLuminance(r: number, g: number, b: number): number {
  const lin = (c: number) => {
    const s = c / 255
    return s <= 0.03928 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4
  }
  return 0.2126 * lin(r) + 0.7152 * lin(g) + 0.0722 * lin(b)
}

export function contrastRatio(lumA: number, lumB: number): number {
  const hi = Math.max(lumA, lumB)
  const lo = Math.min(lumA, lumB)
  return (hi + 0.05) / (lo + 0.05)
}

/** Approximate ink luminance under the overlay (not the plate matte). */
export function inkLuminance(blankKind: 'light' | 'dark'): number {
  return blankKind === 'light' ? 0.06 : 0.94
}

export type PlacementSampleRect = {
  x0: number
  y0: number
  x1: number
  y1: number
}

export function placementSampleRect(
  placement: Pick<PreviewPlacement, 'left' | 'top' | 'width'>,
  imgW: number,
  imgH: number
): PlacementSampleRect {
  const halfW = (placement.width * imgW) / 2
  const halfH = halfW * WORDMARK_HALF_HEIGHT_RATIO * 2
  const cx = placement.left * imgW
  const cy = placement.top * imgH
  return {
    x0: Math.max(0, Math.floor(cx - halfW)),
    y0: Math.max(0, Math.floor(cy - halfH)),
    x1: Math.min(imgW, Math.ceil(cx + halfW)),
    y1: Math.min(imgH, Math.ceil(cy + halfH)),
  }
}

export async function averageLuminanceUnderPlacement(
  publicImagePath: string,
  placement: Pick<PreviewPlacement, 'left' | 'top' | 'width'>
): Promise<number | null> {
  const file = path.join(process.cwd(), 'public', publicImagePath.replace(/^\//, ''))
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
  let sum = 0
  let n = 0
  for (let i = 0; i < data.length; i += ch) {
    const a = ch > 3 ? data[i + 3] : 255
    if (a < 20) continue
    const r = data[i]!
    const g = data[i + 1]!
    const b = data[i + 2]!
    if (r > 236 && g > 236 && b > 236) continue
    sum += relativeLuminance(r, g, b)
    n++
  }
  return n ? sum / n : null
}

export async function measureInkContrast(input: {
  imageSrc: string
  placement: Pick<PreviewPlacement, 'left' | 'top' | 'width'>
  blankKind: 'light' | 'dark'
}): Promise<{ ratio: number; backgroundLum: number; inkLum: number } | null> {
  const bg = await averageLuminanceUnderPlacement(input.imageSrc, input.placement)
  if (bg == null) return null
  const ink = inkLuminance(input.blankKind)
  return {
    backgroundLum: bg,
    inkLum: ink,
    ratio: contrastRatio(ink, bg),
  }
}

export type ContrastAuditRow = {
  slug: string
  slide: number
  context: 'grid' | 'pdp'
  ratio: number
  blankKind: 'light' | 'dark'
  backgroundLum: number
}

export async function auditShopOverlayContrastForItem(
  item: ShopCatalogItem
): Promise<ContrastAuditRow[]> {
  const failures: ContrastAuditRow[] = []
  const galleryIndex = shopHeroGalleryIndex(item)
  const imageSrc = item.gallery[galleryIndex] ?? item.gridImage
  const placementResolved = resolveShopGalleryPlacement({
    slug: item.slug,
    productType: item.productType,
    catalogKey: `shop/${item.slug}`,
    galleryIndex,
    galleryLength: item.gallery.length,
    printArea: item.printArea,
  })
  if (!placementResolved) return failures

  const { inkBlankKind: _i, ...placement } = placementResolved
  const blankKind = placementResolved.inkBlankKind ?? 'light'
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
  const ink = preview?.blankKind ?? blankKind
  const leatherPatch = /leather-patch/i.test(item.slug)
  const samplePlacement = leatherPatch
    ? { ...placement, width: placement.width * 0.72, top: placement.top - placement.width * 0.02 }
    : placement
  const measure = await measureInkContrast({ imageSrc, placement: samplePlacement, blankKind: ink })
  if (measure && measure.ratio < MIN_CONTRAST_RATIO) {
    failures.push({
      slug: item.slug,
      slide: galleryIndex,
      context: 'grid',
      ratio: measure.ratio,
      blankKind: ink,
      backgroundLum: measure.backgroundLum,
    })
  }
  return failures
}

export async function auditAllShopOverlayContrasts(
  items: ShopCatalogItem[]
): Promise<ContrastAuditRow[]> {
  const rows: ContrastAuditRow[] = []
  for (const item of items) {
    rows.push(...(await auditShopOverlayContrastForItem(item)))
  }
  return rows
}

export { MIN_CONTRAST_RATIO }
