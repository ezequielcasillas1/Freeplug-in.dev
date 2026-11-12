#!/usr/bin/env node
import { readFileSync } from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import sharp from 'sharp'

const ROOT = path.join(path.dirname(fileURLToPath(import.meta.url)), '..')
const catalog = JSON.parse(readFileSync(path.join(ROOT, 'src/lib/merch/shop/shop-catalog.json'), 'utf8'))
const placements = JSON.parse(
  readFileSync(path.join(ROOT, 'src/lib/merch/shop/shop-gallery-placements.json'), 'utf8')
)

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

async function measure(imageSrc, placement, blankKind) {
  const file = path.join(ROOT, 'public', imageSrc.replace(/^\//, ''))
  const img = sharp(file)
  const { width, height } = await img.metadata()
  const halfW = (placement.width * width) / 2
  const halfH = halfW * WORDMARK_HALF_HEIGHT_RATIO * 2
  const cx = placement.left * width
  const cy = placement.top * height
  const x0 = Math.max(0, Math.floor(cx - halfW))
  const y0 = Math.max(0, Math.floor(cy - halfH))
  const x1 = Math.min(width, Math.ceil(cx + halfW))
  const y1 = Math.min(height, Math.ceil(cy + halfH))
  const { data, info } = await img
    .extract({ left: x0, top: y0, width: x1 - x0, height: y1 - y0 })
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
  if (!n) return null
  const bg = sum / n
  const ink = inkLum(blankKind)
  return { bg, ratio: contrastRatio(ink, bg) }
}

const slugs = process.argv.slice(2)
const list = slugs.length ? catalog.items.filter((i) => slugs.includes(i.slug)) : catalog.items

for (const item of list) {
  const slide = placements.bySlug[item.slug]?.slides?.[0]
  if (!slide?.top) continue
  const src = item.gallery[0]
  const light = await measure(src, slide, 'light')
  const dark = await measure(src, slide, 'dark')
  const best = (light?.ratio ?? 0) >= (dark?.ratio ?? 0) ? 'light' : 'dark'
  const bestR = Math.max(light?.ratio ?? 0, dark?.ratio ?? 0)
  console.log(
    item.slug,
    `L=${light?.ratio.toFixed(2) ?? '—'}`,
    `D=${dark?.ratio.toFixed(2) ?? '—'}`,
    `best=${best}(${bestR.toFixed(2)})`,
    `set=${slide.inkBlankKind}`
  )
}
