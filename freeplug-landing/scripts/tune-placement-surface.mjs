#!/usr/bin/env node
/** Grid-search placement minimizing non-fabric pixels (skin/fur) under bbox. */
import sharp from 'sharp'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const ROOT = path.join(path.dirname(fileURLToPath(import.meta.url)), '..')
const WORDMARK_HALF_HEIGHT_RATIO = 0.11

function isSkin(r, g, b) {
  const spread = Math.max(r, g, b) - Math.min(r, g, b)
  if (spread < 42 && r > 110 && g > 85 && b < 140) return false
  if (g > 100 && r < 225 && b < 145 && r - b < 120) return false
  return r > 95 && g > 45 && b > 35 && r > g + 12 && g > b
}

function isFur(r, g, b) {
  const spread = Math.max(r, g, b) - Math.min(r, g, b)
  const max = Math.max(r, g, b)
  const min = Math.min(r, g, b)
  if (max < 85 && spread < 40) return true
  if (min > 40 && max < 160 && spread < 35 && r > g && g > b) return true
  return false
}

async function nonFabricShare(file, placement) {
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
  if (x1 <= x0 || y1 <= y0) return 1
  const { data, info } = await img
    .extract({ left: x0, top: y0, width: x1 - x0, height: y1 - y0 })
    .ensureAlpha()
    .raw()
    .toBuffer({ resolveWithObject: true })
  const ch = info.channels
  let bad = 0
  let n = 0
  for (let i = 0; i < data.length; i += ch) {
    const a = ch > 3 ? data[i + 3] : 255
    if (a < 20) continue
    const r = data[i]
    const g = data[i + 1]
    const b = data[i + 2]
    if (r > 236 && g > 236 && b > 236) continue
    n++
    if (isSkin(r, g, b) || isFur(r, g, b)) bad++
  }
  return n ? bad / n : 1
}

const jobs = [
  {
    slug: '507',
    src: 'public/merch/shop/blanks/507-0.webp',
    tops: [0.68, 0.72, 0.76, 0.8],
    lefts: [0.44, 0.48, 0.52],
    widths: [0.14, 0.16, 0.18],
  },
  {
    slug: '571',
    src: 'public/merch/shop/blanks/571-0.webp',
    tops: [0.52, 0.56, 0.58, 0.6, 0.62],
    lefts: [0.38, 0.42, 0.46, 0.5],
    widths: [0.16, 0.18, 0.2],
  },
  {
    slug: '553-1',
    src: 'public/merch/shop/blanks/553-1.webp',
    tops: [0.44, 0.48, 0.52, 0.56],
    lefts: [0.46, 0.5, 0.54],
    widths: [0.18, 0.2, 0.22],
  },
  {
    slug: '1925-1',
    src: 'public/merch/shop/blanks/1925-1.webp',
    tops: [0.38, 0.42, 0.46],
    lefts: [0.48, 0.5, 0.52],
    widths: [0.2, 0.22],
  },
]

for (const job of jobs) {
  const file = path.join(ROOT, job.src)
  let best = { share: 1 }
  for (const top of job.tops) {
    for (const left of job.lefts) {
      for (const width of job.widths) {
        const share = await nonFabricShare(file, { top, left, width })
        if (share < best.share) best = { top, left, width, share }
      }
    }
  }
  console.log(job.slug, best)
}
