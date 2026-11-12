import { existsSync } from 'node:fs'
import path from 'node:path'
import sharp from 'sharp'
import type { PreviewPlacement } from '@/lib/merch/preview/placement-defaults'
import { DEFAULT_BUYER_WORDMARK_BRAND } from '@/lib/merch/preview/buyer-wordmark-brand'
import { DEFAULT_BUYER_WORDMARK_STYLE } from '@/lib/merch/preview/buyer-wordmark-style'
import { buyerWordmarkArtPublicPath } from '@/lib/merch/preview/buyer-wordmark-art-paths'
import { contrastRatio, relativeLuminance } from './shop-overlay-contrast'
/** Measure at ~2× buyer grid card width so “% of tile” matches PDP/grid perception. */
const VISIBILITY_MOCKUP_WIDTH_PX = 480

export const MIN_RENDERED_OVERLAY_CHANGED_SHARE = 0.004
/** Minimum fraction of placement bbox pixels that must change (≈0.4% tile when mark ~1% of tile). */
export const MIN_RENDERED_OVERLAY_MARK_CHANGED_SHARE = 0.06
export const MIN_RENDERED_OVERLAY_CONTRAST = 3
const PIXEL_DELTA_THRESHOLD = 14

function publicPathToAbs(publicImagePath: string): string {
  return path.join(process.cwd(), 'public', publicImagePath.replace(/^\//, ''))
}

/**
 * Simulate overlay-on vs overlay-off by compositing buyer cursive art at the hero placement,
 * then measure changed pixels (area + contrast) on the mockup raster.
 */
export async function measureRenderedOverlayPixelDelta(
  imageSrc: string,
  placement: Pick<PreviewPlacement, 'left' | 'top' | 'width'>,
  blankKind: 'light' | 'dark'
): Promise<{ changedShare: number; markChangedShare: number; contrastRatio: number } | null> {
  const baseFile = publicPathToAbs(imageSrc)
  if (!existsSync(baseFile)) return null
  const artPath = publicPathToAbs(
    buyerWordmarkArtPublicPath(DEFAULT_BUYER_WORDMARK_STYLE, DEFAULT_BUYER_WORDMARK_BRAND, blankKind)
  )
  if (!existsSync(artPath)) return null

  const loaded = sharp(baseFile).ensureAlpha()
  const meta0 = await loaded.metadata()
  if (!meta0.width || !meta0.height) return null
  const scale = VISIBILITY_MOCKUP_WIDTH_PX / meta0.width
  const imgW = VISIBILITY_MOCKUP_WIDTH_PX
  const imgH = Math.max(1, Math.round(meta0.height * scale))
  const baseRaw = await loaded.resize(imgW, imgH).raw().toBuffer()

  const markW = Math.max(8, Math.round(placement.width * imgW))
  const artMeta = await sharp(artPath).metadata()
  if (!artMeta.width || !artMeta.height) return null
  const markH = Math.max(4, Math.round((markW * artMeta.height) / artMeta.width))
  const markBuf = await sharp(artPath).resize(markW, markH).ensureAlpha().raw().toBuffer()

  const cx = Math.round(placement.left * imgW)
  const cy = Math.round(placement.top * imgH)
  const left = Math.max(0, cx - Math.floor(markW / 2))
  const top = Math.max(0, cy - Math.floor(markH / 2))

  const channels = 4
  const totalPx = imgW * imgH
  let changed = 0
  const lumBefore: number[] = []
  const lumAfter: number[] = []

  for (let y = 0; y < markH; y++) {
    const imgY = top + y
    if (imgY >= imgH) continue
    for (let x = 0; x < markW; x++) {
      const imgX = left + x
      if (imgX >= imgW) continue
      const artI = (y * markW + x) * channels
      const artA = markBuf[artI + 3] ?? 255
      if (artA < 16) continue
      const imgI = (imgY * imgW + imgX) * channels
      const ar = markBuf[artI]!
      const ag = markBuf[artI + 1]!
      const ab = markBuf[artI + 2]!
      const br = baseRaw[imgI]!
      const bg = baseRaw[imgI + 1]!
      const bb = baseRaw[imgI + 2]!
      const alpha = artA / 255
      const or = Math.round(br * (1 - alpha) + ar * alpha)
      const og = Math.round(bg * (1 - alpha) + ag * alpha)
      const ob = Math.round(bb * (1 - alpha) + ab * alpha)
      const delta = Math.max(Math.abs(or - br), Math.abs(og - bg), Math.abs(ob - bb))
      if (delta < PIXEL_DELTA_THRESHOLD) continue
      changed++
      lumBefore.push(relativeLuminance(br, bg, bb))
      lumAfter.push(relativeLuminance(or, og, ob))
    }
  }

  const markArea = markW * markH
  if (!changed) return { changedShare: 0, markChangedShare: 0, contrastRatio: 1 }

  const changedShare = changed / totalPx
  const markChangedShare = changed / Math.max(1, markArea)
  let minContrast = Number.POSITIVE_INFINITY
  for (let i = 0; i < lumBefore.length; i++) {
    const ratio = contrastRatio(lumBefore[i]!, lumAfter[i]!)
    if (ratio < minContrast) minContrast = ratio
  }
  return { changedShare, markChangedShare, contrastRatio: minContrast }
}
