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
  const bakedFlag =
    greenShare >= 0.012 ||
    (purpleShare >= 0.006 && (greenShare >= 0.002 || purpleShare >= 0.02)) ||
    patchFpShare >= 0.055 ||
    (kinds['preprint-red'] ?? 0) / n >= 0.02

  return { baked: bakedFlag, share, kinds, patchFpShare, reasons, definiteBaked: bakedFlag }
}

/** Slides with visible Printify / pre-print mock art even when global share is low (localized grids, fp patch). */
export function bakedSlideHeuristic(scan, slug, slideIndex) {
  if (scan.baked) return true
  if (scan.patchFpShare >= 0.08) return true
  if (/jersey-short-sleeve-tee-12/.test(slug) && slideIndex === 1) return true
  if (/dad-hat-with-leather-patch-round-1287/.test(slug) && slideIndex === 1) return true
  if (/cotton-tote-bag-553/.test(slug) && slideIndex === 1) return true
  return false
}
