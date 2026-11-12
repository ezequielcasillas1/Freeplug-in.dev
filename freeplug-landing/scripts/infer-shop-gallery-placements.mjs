/**
 * Analyze each shop blank WebP and emit per-slide preview placements + optional hide flags.
 * Merges manual overrides from shop-gallery-placements-overrides.json.
 *
 * Usage: node scripts/infer-shop-gallery-placements.mjs
 */
import { existsSync, readFileSync, writeFileSync } from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import sharp from 'sharp'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const ROOT = path.join(__dirname, '..')
const CATALOG = path.join(ROOT, 'src/lib/merch/shop/shop-catalog.json')
const OUT = path.join(ROOT, 'src/lib/merch/shop/shop-gallery-placements.json')
const OVERRIDES = path.join(ROOT, 'src/lib/merch/shop/shop-gallery-placements-overrides.json')

const COLLECTION_SLUG_TO_TYPE = {
  drinkware: 'mug',
  hats: 'hat',
  apparel: 'apparel',
  'bags-accessories': 'bag',
  'kids-baby': 'kids-&-baby',
  pets: 'pets',
  'home-living': 'home-&-decor',
  'home-faith': 'home-&-decor',
  'desk-extras': 'tech-&-desk',
  'wall-art': 'wall-art',
  outdoor: 'outdoor-&-seasonal',
}

function inferProductType(slug, productType, tab) {
  if (slug === 'hero-crewneck') return 'crewneck'
  if (/canvas/i.test(slug)) return 'canvas'
  if (/mug|tumbler|bottle/i.test(slug)) return 'mug'
  if (/poster|print/i.test(slug)) return 'poster'
  if (/sticker/i.test(slug)) return 'sticker'
  if (/tote|bag|duffel|backpack|fanny|pouch/i.test(slug)) return 'bag'
  if (/hat|cap|beanie|visor/i.test(slug)) return 'hat'
  if (/hoodie/i.test(slug)) return 'hoodie'
  if (/towel|flag|tapestry|wall/i.test(slug)) return 'wall-art'
  if (/tee|shirt|tank|sweat|crewneck|polo|shorts|jogger|pants/i.test(slug)) return 'apparel'
  if (tab && COLLECTION_SLUG_TO_TYPE[tab]) return COLLECTION_SLUG_TO_TYPE[tab]
  return productType ?? 'collection'
}

function isBackground(r, g, b, a = 255) {
  if (a < 20) return true
  if (r > 236 && g > 236 && b > 236) return true
  if (r > 248 && g > 248 && b > 248) return true
  return false
}

async function foregroundBBox(publicPath) {
  const file = path.join(ROOT, 'public', publicPath.replace(/^\//, ''))
  if (!existsSync(file)) return null
  const img = sharp(file)
  const { width, height } = await img.metadata()
  if (!width || !height) return null
  const { data, info } = await img.ensureAlpha().raw().toBuffer({ resolveWithObject: true })
  let minX = width,
    minY = height,
    maxX = 0,
    maxY = 0,
    n = 0
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const i = (y * width + x) * info.channels
      const a = info.channels > 3 ? data[i + 3] : 255
      const r = data[i],
        g = data[i + 1],
        b = data[i + 2]
      if (isBackground(r, g, b, a)) continue
      n++
      if (x < minX) minX = x
      if (x > maxX) maxX = x
      if (y < minY) minY = y
      if (y > maxY) maxY = y
    }
  }
  if (!n) return null
  return {
    width,
    height,
    coverage: n / (width * height),
    minX,
    minY,
    maxX,
    maxY,
    cx: (minX + maxX + 1) / 2 / width,
    cy: (minY + maxY + 1) / 2 / height,
    bw: (maxX - minX + 1) / width,
    bh: (maxY - minY + 1) / height,
  }
}

function placementFromBBox(bbox, productType, printPosition) {
  const isolated = bbox.coverage >= 0.06 && bbox.coverage <= 0.72 && bbox.bh <= 0.88

  if (isolated) {
    const w = Math.min(0.42, Math.max(0.14, bbox.bw * 0.48))
    const spanY = bbox.maxY - bbox.minY + 1
    if (productType === 'hat') {
      const top = (bbox.minY + spanY * 0.22) / bbox.height
      return { top, left: bbox.cx, width: Math.min(0.28, w) }
    }
    if (productType === 'mug' || productType === 'drinkware') {
      const top = (bbox.minY + spanY * 0.38) / bbox.height
      return { top, left: bbox.cx, width: Math.min(0.3, w) }
    }
    if (productType === 'bag') {
      const top = (bbox.minY + spanY * 0.48) / bbox.height
      return { top, left: bbox.cx, width: Math.min(0.36, w) }
    }
    const top = (bbox.minY + spanY * 0.32) / bbox.height
    return { top, left: bbox.cx, width: w }
  }

  // Lifestyle / full-bleed mockups
  const presets = {
    hat: { top: 0.21, left: 0.5, width: 0.22 },
    bag: { top: 0.56, left: 0.5, width: 0.3 },
    mug: { top: 0.46, left: 0.5, width: 0.26 },
    'wall-art': { top: 0.4, left: 0.5, width: 0.38 },
    canvas: { top: 0.38, left: 0.5, width: 0.36 },
    poster: { top: 0.38, left: 0.5, width: 0.4 },
    sticker: { top: 0.5, left: 0.5, width: 0.32 },
    hoodie: { top: 0.41, left: 0.5, width: 0.3 },
    sweatshirt: { top: 0.41, left: 0.5, width: 0.3 },
    apparel: { top: 0.4, left: 0.5, width: 0.3 },
    default: { top: 0.44, left: 0.5, width: 0.3 },
  }
  const base = presets[productType] ?? presets.default
  if (printPosition && typeof printPosition.y === 'number' && typeof printPosition.x === 'number') {
    return {
      top: printPosition.y,
      left: printPosition.x,
      width: Math.min(0.5, Math.max(0.14, (printPosition.scale ?? 0.38) * 0.58)),
      scale: printPosition.scale,
    }
  }
  return { ...base }
}

function roundPlacement(p) {
  const out = {
    top: Math.round(p.top * 1000) / 1000,
    left: Math.round(p.left * 1000) / 1000,
    width: Math.round(p.width * 1000) / 1000,
  }
  if (p.scale != null) out.scale = Math.round(p.scale * 1000) / 1000
  if (p.rotate != null) out.rotate = Math.round(p.rotate * 10) / 10
  if (p.hide) out.hide = true
  return out
}

const overrides = existsSync(OVERRIDES)
  ? JSON.parse(readFileSync(OVERRIDES, 'utf8')).bySlug ?? {}
  : {}

const catalog = JSON.parse(readFileSync(CATALOG, 'utf8'))
const bySlug = {}

for (const item of catalog.items) {
  const productType = inferProductType(item.slug, item.productType, item.tab)
  const slides = []
  const gallery = item.gallery ?? []
  for (let i = 0; i < gallery.length; i++) {
    const src = gallery[i]
    const ov = overrides[item.slug]?.slides?.[i]
    if (ov) {
      slides.push(roundPlacement(ov))
      continue
    }
    const bbox = await foregroundBBox(src)
    if (!bbox) {
      slides.push(roundPlacement(placementFromBBox({ coverage: 1, cx: 0.5, cy: 0.5, bw: 1, bh: 1, minY: 0, maxY: 999, height: 1000, width: 1000 }, productType, item.printArea?.position)))
      continue
    }
    if (bbox.coverage < 0.04) {
      slides.push({ hide: true, top: 0.5, left: 0.5, width: 0.2 })
      continue
    }
    const placement = placementFromBBox(bbox, productType, item.printArea?.position)
    slides.push(roundPlacement(placement))
  }
  bySlug[item.slug] = { slides }
}

writeFileSync(OUT, JSON.stringify({ version: 1, generatedAt: new Date().toISOString(), bySlug }, null, 2) + '\n')
console.log(`Wrote ${Object.keys(bySlug).length} items → ${path.relative(ROOT, OUT)}`)
