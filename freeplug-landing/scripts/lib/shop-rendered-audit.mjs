/**
 * PDP screenshot QA: Printify sample text bands, skin under mark, mark on empty background.
 */
import sharp from 'sharp'

/** Catalog blank slide: high band = YOUR DESIGN / ENGRAVE slogans in mock art. */
export const CATALOG_SAMPLE_TEXT_FAIL = 0.22
/** Rendered hero (overlay off): Printify lime/purple sample colors visible in frame. */
export const RENDER_PRINTIFY_SAMPLE_FAIL = 0.06
const SAMPLE_TEXT_BAND_THRESHOLD = 0.24
const SKIN_SHARE_THRESHOLD = 0.22
const JEWELRY_SKIN_SHARE_THRESHOLD = 0.82
const BACKDROP_LUM_THRESHOLD = 0.92
const BACKDROP_SHARE_THRESHOLD = 0.38

function relativeLum(r, g, b) {
  return 0.2126 * r + 0.7152 * g + 0.0722 * b
}

function isSkin(r, g, b) {
  const spread = Math.max(r, g, b) - Math.min(r, g, b)
  if (spread < 42 && r > 110 && g > 85 && b < 140) return false
  if (g > 100 && r < 225 && b < 145 && r - b < 120) return false
  return r > 95 && g > 45 && b > 35 && r > g + 12 && g > b
}

function tagSamplePixel(r, g, b, a = 255) {
  if (a < 20) return null
  if (g >= 155 && g > r * 1.35 && b < g * 0.82 && r < 175) return 'printify-green'
  if (b >= 125 && r >= 95 && g <= 100 && b - g >= 30) return 'printify-purple'
  if (g >= 175 && b >= 140 && r < 95) return 'printify-cyan'
  return null
}

/** High-contrast non-green text blocks (YOUR DESIGN / ENGRAVE slogans). */
export async function placeholderTextBandShareFromPng(pngBuffer) {
  const { data, info } = await sharp(pngBuffer)
    .resize(360, 360, { fit: 'inside' })
    .ensureAlpha()
    .raw()
    .toBuffer({ resolveWithObject: true })
  const w = info.width
  const h = info.height
  const ch = info.channels
  const x0 = Math.floor(w * 0.12)
  const x1 = Math.floor(w * 0.88)
  const y0 = Math.floor(h * 0.12)
  const y1 = Math.floor(h * 0.88)
  let text = 0
  let n = 0
  for (let y = y0; y < y1; y++) {
    for (let x = x0; x < x1; x++) {
      const i = (y * w + x) * ch
      const r = data[i]
      const g = data[i + 1]
      const b = data[i + 2]
      const a = ch > 3 ? data[i + 3] : 255
      if (a < 20 || (r > 240 && g > 240 && b > 240)) continue
      n++
      const L = relativeLum(r, g, b)
      const spread = Math.max(r, g, b) - Math.min(r, g, b)
      if (L > 40 && L < 215 && spread > 22 && spread < 130) text++
    }
  }
  return n ? text / n : 0
}

export async function printifySampleColorShareFromPng(pngBuffer) {
  const { data, info } = await sharp(pngBuffer)
    .resize(360, 360, { fit: 'inside' })
    .ensureAlpha()
    .raw()
    .toBuffer({ resolveWithObject: true })
  const w = info.width
  const h = info.height
  const ch = info.channels
  let n = 0
  let baked = 0
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const i = (y * w + x) * ch
      const r = data[i]
      const g = data[i + 1]
      const b = data[i + 2]
      const a = ch > 3 ? data[i + 3] : 255
      if (a < 20) continue
      n++
      const tag = tagSamplePixel(r, g, b, a)
      if (tag === 'printify-green' || tag === 'printify-purple') baked++
    }
  }
  return n ? baked / n : 0
}

const WORDMARK_HALF_HEIGHT_RATIO = 0.22

function placementRect(imgW, imgH, placement) {
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

/** Skin + near-white backdrop share under mark anchor (overlay OFF mock). */
export async function markRegionSurfaceShareFromPng(pngBuffer, placement) {
  const { data, info } = await sharp(pngBuffer).ensureAlpha().raw().toBuffer({ resolveWithObject: true })
  const w = info.width
  const h = info.height
  const ch = info.channels
  const rect = placementRect(w, h, placement)
  let n = 0
  let skin = 0
  let backdrop = 0
  for (let y = rect.y0; y < rect.y1; y++) {
    for (let x = rect.x0; x < rect.x1; x++) {
      const i = (y * w + x) * ch
      const r = data[i]
      const g = data[i + 1]
      const b = data[i + 2]
      const a = ch > 3 ? data[i + 3] : 255
      if (a < 20) continue
      n++
      if (isSkin(r, g, b)) skin++
      const lum = relativeLum(r, g, b) / 255
      if (lum >= BACKDROP_LUM_THRESHOLD) backdrop++
    }
  }
  return {
    skinShare: n ? skin / n : 0,
    backdropShare: n ? backdrop / n : 0,
  }
}

/**
 * @returns {{ pass: boolean, reasons: string[], textBand: number, skinShare: number, backdropShare: number, printifyShare: number }}
 */
export async function auditRenderedHeroPng(pngBuffer, placement, slug = '') {
  const placementWithSlug = placement ? { ...placement, slugTag: slug } : null
  const reasons = []
  const textBand = await placeholderTextBandShareFromPng(pngBuffer)
  const printifyShare = await printifySampleColorShareFromPng(pngBuffer)
  const { skinShare, backdropShare } = placementWithSlug
    ? await markRegionSurfaceShareFromPng(pngBuffer, placementWithSlug)
    : { skinShare: 0, backdropShare: 0 }

  if (printifyShare >= RENDER_PRINTIFY_SAMPLE_FAIL) {
    reasons.push(`render-printify-sample:${printifyShare.toFixed(4)}`)
  } else if (textBand >= SAMPLE_TEXT_BAND_THRESHOLD && printifyShare >= 0.008) {
    reasons.push(`sample-text-band:${textBand.toFixed(3)}`)
  }
  const skipSkin =
    /snapback|dad-hat|trucker-cap|baseball-cap|beanie|candle|mug|bottle|sticker|poster|short-4616|blanket-1124/i.test(
      slug
    )
  const skinLimit = /necklace-engraving/i.test(slug) ? JEWELRY_SKIN_SHARE_THRESHOLD : SKIN_SHARE_THRESHOLD
  if (placementWithSlug && !skipSkin && skinShare >= skinLimit) {
    reasons.push(`mark-on-skin:${skinShare.toFixed(3)}`)
  }
  const lifestyleProduct =
    placement &&
    (/necklace-engraving|bracelet-engraving|picnic-blanket|wooden-ornament|pet-bandana|joggers-embroidery/i.test(
      placement.slugTag ?? ''
    ) ||
      false)

  if (placement && lifestyleProduct && backdropShare >= BACKDROP_SHARE_THRESHOLD) {
    reasons.push(`mark-off-product:${backdropShare.toFixed(3)}`)
  }

  if (placement && /posicharge-competitor-7-pocketed-short-4616/.test(placement.slugTag ?? '')) {
    const { data, info } = await sharp(pngBuffer).ensureAlpha().raw().toBuffer({ resolveWithObject: true })
    const w = info.width
    const h = info.height
    const ch = info.channels
    const rect = placementRect(w, h, placement)
    const lums = []
    for (let y = rect.y0; y < rect.y1; y++) {
      for (let x = rect.x0; x < rect.x1; x++) {
        const i = (y * w + x) * ch
        lums.push(relativeLum(data[i], data[i + 1], data[i + 2]) / 255)
      }
    }
    if (lums.length > 8) {
      const mean = lums.reduce((a, b) => a + b, 0) / lums.length
      const variance = lums.reduce((a, b) => a + (b - mean) ** 2, 0) / lums.length
      if (Math.sqrt(variance) >= 0.26) {
        reasons.push(`mark-spans-surfaces:${Math.sqrt(variance).toFixed(3)}`)
      }
    }
  }

  return {
    pass: reasons.length === 0,
    reasons,
    textBand,
    skinShare,
    backdropShare,
    printifyShare,
  }
}

export {
  SAMPLE_TEXT_BAND_THRESHOLD,
  SKIN_SHARE_THRESHOLD,
  BACKDROP_SHARE_THRESHOLD,
}
