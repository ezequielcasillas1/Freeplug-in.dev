#!/usr/bin/env node
/**
 * Paints over the baked Supreme slogan box on local shirt JPEGs → *-blank-front.jpg
 * for preview overlays (no ghosting). Normal product mockups stay unchanged.
 */
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import sharp from 'sharp'

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), '..')
const specs = JSON.parse(
  fs.readFileSync(path.join(root, 'src/lib/merch/shirts/supreme-preview-specs.json'), 'utf8')
)
const shirtsDir = path.join(root, 'public/merch/shirts')
const colors = ['black', 'charcoal', 'natural', 'white']

const FABRIC = {
  black: { r: 28, g: 28, b: 28 },
  charcoal: { r: 72, g: 72, b: 72 },
  natural: { r: 232, g: 224, b: 212 },
  white: { r: 248, g: 248, b: 248 },
}

function bakedBoxPixels(spec, size) {
  const p = spec.placement
  const lines = spec.bakedLineCount ?? 2
  const w = Math.round(p.width * size * 1.06)
  const h = Math.round(p.width * size * (0.34 * lines + 0.08))
  const x = Math.round(p.left * size) - 4
  const y = Math.round(p.top * size - h / 2) - 4
  return { x: Math.max(0, x), y: Math.max(0, y), w: Math.min(size - x, w), h: Math.min(size - y, h) }
}

for (const spec of specs) {
  for (const color of colors) {
    const src = path.join(shirtsDir, `${spec.slug}-${color}-front.jpg`)
    const dest = path.join(shirtsDir, `${spec.slug}-${color}-blank-front.jpg`)
    if (!fs.existsSync(src)) {
      console.warn('skip missing', src)
      continue
    }
    const { data, info } = await sharp(src).ensureAlpha().raw().toBuffer({ resolveWithObject: true })
    const { width, height } = info
    const box = bakedBoxPixels(spec, width)
    const fill = FABRIC[color]
    const feather = 3
    for (let row = box.y; row < box.y + box.h && row < height; row++) {
      for (let col = box.x; col < box.x + box.w && col < width; col++) {
        const edge =
          Math.min(col - box.x, box.x + box.w - col, row - box.y, box.y + box.h - row)
        const t = edge < feather ? edge / feather : 1
        const i = (row * width + col) * 4
        data[i] = Math.round(data[i] * (1 - t) + fill.r * t)
        data[i + 1] = Math.round(data[i + 1] * (1 - t) + fill.g * t)
        data[i + 2] = Math.round(data[i + 2] * (1 - t) + fill.b * t)
        data[i + 3] = 255
      }
    }
    await sharp(data, { raw: { width, height, channels: 4 } }).jpeg({ quality: 92 }).toFile(dest)
    console.log('wrote', path.basename(dest))
  }
}
