/**
 * Detect Printify baked mock art: YOUR DESIGN greens, purple grids, orange fp patterns, HI! etc.
 */
import { existsSync } from 'node:fs'
import path from 'node:path'
import sharp from 'sharp'

function tagPixel(r, g, b, a = 255) {
  if (a < 20) return null
  if (r > 236 && g > 236 && b > 236) return null
  // Lime "YOUR DESIGN" blocks (strong)
  if (g >= 155 && g > r * 1.35 && b < g * 0.82 && r < 175) return 'printify-green'
  // Purple mock grid cells
  if (b >= 125 && r >= 95 && g <= 100 && b - g >= 30) return 'printify-purple'
  // Bright mint placeholder on products
  if (g >= 175 && b >= 140 && r < 95) return 'printify-cyan'
  // Saturated pre-print slogans
  if (r >= 210 && g <= 90 && b <= 90) return 'preprint-red'
  return null
}

/** Orange repeating brand texture on leather patch (1287-class). */
function isPatchFpPixel(r, g, b, y, height) {
  if (y / height > 0.38) return false
  return r >= 165 && g >= 85 && g <= 145 && b <= 95 && r - b > 75 && r > g + 20
}

function relativeLum(r, g, b) {
  return 0.2126 * r + 0.7152 * g + 0.0722 * b
}

/**
 * Printify "YOUR DESIGN" / engrave slogan blocks (gray or mint on product) — central band only.
 * @returns {Promise<number>} share 0–1 of band pixels that look like sample placeholder text
 */
export async function placeholderTextBandShare(publicPath, root) {
  const file = path.join(root, 'public', publicPath.replace(/^\//, ''))
  if (!existsSync(file)) return 0
  const img = sharp(file)
  const { data, info } = await img
    .resize(256, 256, { fit: 'inside' })
    .ensureAlpha()
    .raw()
    .toBuffer({ resolveWithObject: true })
  const w = info.width
  const h = info.height
  const ch = info.channels
  const x0 = Math.floor(w * 0.18)
  const x1 = Math.floor(w * 0.82)
  const y0 = Math.floor(h * 0.22)
  const y1 = Math.floor(h * 0.78)
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

/**
 * @param {string} publicPath
 * @param {string} root
 */
export async function analyzeBakedMockArt(publicPath, root) {
  const file = path.join(root, 'public', publicPath.replace(/^\//, ''))
  if (!existsSync(file)) {
    return { baked: false, share: 0, kinds: {}, reasons: ['missing-file'] }
  }
  const img = sharp(file)
  const { width, height } = await img.metadata()
  if (!width || !height) {
    return { baked: false, share: 0, kinds: {}, reasons: ['bad-image'] }
  }
  const { data, info } = await img.ensureAlpha().raw().toBuffer({ resolveWithObject: true })
  const ch = info.channels
  let n = 0
  let baked = 0
  let patchFp = 0
  let patchN = 0
  /** @type {Record<string, number>} */
  const kinds = {}
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const i = (y * width + x) * ch
      const r = data[i]
      const g = data[i + 1]
      const b = data[i + 2]
      const a = ch > 3 ? data[i + 3] : 255
      if (a < 20) continue
      if (r > 236 && g > 236 && b > 236) continue
      n++
      const tag = tagPixel(r, g, b, a)
      if (tag) {
        baked++
        kinds[tag] = (kinds[tag] ?? 0) + 1
      }
      if (y < height * 0.38) {
        patchN++
        if (isPatchFpPixel(r, g, b, y, height)) patchFp++
      }
    }
  }
  const share = n ? baked / n : 0
  const patchFpShare = patchN ? patchFp / patchN : 0
  const reasons = Object.entries(kinds)
    .sort((a, b) => b[1] - a[1])
    .map(([k, c]) => `${k}:${(c / n).toFixed(4)}`)
  if (patchFpShare >= 0.055) reasons.push(`orange-fp-pattern-crown:${patchFpShare.toFixed(4)}`)

  const greenShare = (kinds['printify-green'] ?? 0) / n
  const purpleShare = (kinds['printify-purple'] ?? 0) / n
  const textBandShare = await placeholderTextBandShare(publicPath, root)
  const bakedFlag =
    greenShare >= 0.012 ||
    (purpleShare >= 0.006 && (greenShare >= 0.002 || purpleShare >= 0.02)) ||
    patchFpShare >= 0.055 ||
    (kinds['preprint-red'] ?? 0) / n >= 0.02 ||
    (textBandShare >= 0.55 && (greenShare >= 0.002 || purpleShare >= 0.002))

  const reasonsOut = [...reasons]
  if (textBandShare >= 0.45) reasonsOut.push(`placeholder-text-band:${textBandShare.toFixed(4)}`)

  return {
    baked: bakedFlag,
    share,
    kinds,
    patchFpShare,
    textBandShare,
    reasons: reasonsOut,
    definiteBaked: bakedFlag,
  }
}

/** Slides with visible Printify / pre-print mock art even when global share is low (localized grids, fp patch). */
export function bakedSlideHeuristic(scan, slug, slideIndex) {
  if (scan.baked) return true
  if (scan.textBandShare >= 0.55 && (scan.kinds?.['printify-green'] || scan.kinds?.['printify-purple'])) return true
  if (scan.patchFpShare >= 0.08) return true
  if (/jersey-short-sleeve-tee-12/.test(slug) && slideIndex === 1) return true
  if (/dad-hat-with-leather-patch-round-1287/.test(slug) && slideIndex === 1) return true
  if (/cotton-tote-bag-553/.test(slug) && slideIndex === 1) return true
  if (/necklace-engraving|bracelet-engraving/i.test(slug) && slideIndex === 0 && scan.textBandShare >= 0.32) return true
  if (/kiss-cut-stickers-400/.test(slug) && slideIndex === 0 && scan.textBandShare >= 0.32) return true
  if (/pu-leather-phone-cases-engraving/.test(slug) && slideIndex === 1 && scan.textBandShare >= 0.32) return true
  return false
}

/** Pick cleaner slide index when both gallery images exist (lower placeholder text + color bake). */
export async function cleanerGallerySlideIndex(gallery, root, slug) {
  if (!gallery?.length) return 0
  if (gallery.length === 1) return 0
  const scores = []
  for (let i = 0; i < gallery.length; i++) {
    const scan = await analyzeBakedMockArt(gallery[i], root)
    const baked = scan.baked || bakedSlideHeuristic(scan, slug, i)
    scores.push({ i, baked, text: scan.textBandShare ?? 0, share: scan.share ?? 0 })
  }
  const clean = scores.filter((s) => !s.baked)
  const pool = clean.length ? clean : scores
  pool.sort((a, b) => a.text - b.text || a.share - b.share)
  return pool[0].i
}
