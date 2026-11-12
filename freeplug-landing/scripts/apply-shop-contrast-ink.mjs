#!/usr/bin/env node
/** Set hero-slide inkBlankKind from mockup contrast (≥3:1). Run after infer-shop-gallery-placements.mjs */
import { existsSync, readFileSync, writeFileSync } from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import sharp from 'sharp'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const ROOT = path.join(__dirname, '..')
const PLACEMENTS = path.join(ROOT, 'src/lib/merch/shop/shop-gallery-placements.json')
const CATALOG = path.join(ROOT, 'src/lib/merch/shop/shop-catalog.json')
const MIN = 3
const WORDMARK_HALF_HEIGHT_RATIO = 0.11

function relativeLuminance(r, g, b) {
  const lin = (c) => {
    const s = c / 255
    return s <= 0.03928 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4
  }
  return 0.2126 * lin(r) + 0.7152 * lin(g) + 0.0722 * lin(b)
}

function contrastRatio(lumA, lumB) {
  const hi = Math.max(lumA, lumB)
  const lo = Math.min(lumA, lumB)
  return (hi + 0.05) / (lo + 0.05)
}

function inkLum(kind) {
  return kind === 'light' ? 0.06 : 0.94
}

function placementSampleRect(placement, imgW, imgH) {
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

async function avgLum(publicPath, placement) {
  const file = path.join(ROOT, 'public', publicPath.replace(/^\//, ''))
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
    const r = data[i]
    const g = data[i + 1]
    const b = data[i + 2]
    if (r > 236 && g > 236 && b > 236) continue
    sum += relativeLuminance(r, g, b)
    n++
  }
  return n ? sum / n : null
}

async function bestInk(publicPath, placement, plateBacking = false) {
  const bg0 = await avgLum(publicPath, placement)
  if (bg0 == null) return 'light'
  const bg = plateBacking ? Math.max(bg0, 0.84) : bg0
  let best = 'light'
  let bestRatio = 0
  for (const kind of ['light', 'dark']) {
    const ratio = contrastRatio(inkLum(kind), bg)
    if (ratio >= MIN) return kind
    if (ratio > bestRatio) {
      bestRatio = ratio
      best = kind
    }
  }
  return best
}

const catalog = JSON.parse(readFileSync(CATALOG, 'utf8'))
const placements = JSON.parse(readFileSync(PLACEMENTS, 'utf8'))
let fixed = 0

for (const item of catalog.items) {
  const slides = placements.bySlug[item.slug]?.slides ?? []
  for (let idx = 0; idx < item.gallery.length; idx++) {
    const slide = slides[idx]
    if (!slide || slide.hide) continue
    const { top, left, width, wordmarkStyle } = slide
    if (typeof top !== 'number' || typeof left !== 'number' || typeof width !== 'number') continue
    const imageSrc = item.gallery[idx] ?? item.gridImage
    const plate = wordmarkStyle === 'cursive-plate' || wordmarkStyle === 'pop-plate-v2'
    const ink = await bestInk(imageSrc, { top, left, width }, plate)
    if (slide.inkBlankKind !== ink) {
      slide.inkBlankKind = ink
      fixed++
      console.log(item.slug, `slide ${idx}`, '->', ink)
    }
  }
}

writeFileSync(PLACEMENTS, JSON.stringify(placements, null, 2) + '\n')
console.log(`Adjusted inkBlankKind on ${fixed} slide(s).`)
