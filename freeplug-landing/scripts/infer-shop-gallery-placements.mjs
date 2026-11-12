/**
 * Analyze each shop blank WebP and emit per-slide preview placements.
 * Hard rule: wordmark box must stay inside print-zone mask (no skin/straps/zippers).
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

const GRID = 48
const WORDMARK_HALF_HEIGHT_RATIO = 0.11

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
  if (/leather-patch/i.test(slug)) return 'leather-patch-hat'
  if (slug === 'hero-crewneck') return 'crewneck'
  if (/canvas/i.test(slug)) return 'canvas'
  if (/mug|tumbler|bottle/i.test(slug)) return 'mug'
  if (/poster|print/i.test(slug)) return 'poster'
  if (/sticker/i.test(slug)) return 'sticker'
  if (/towel|flag|blanket|velveteen|tapestry|picnic/i.test(slug)) return 'large-flat'
  if (/tote|bag|duffel|backpack|fanny|pouch/i.test(slug)) return 'bag'
  if (/zippered/i.test(slug)) return 'zip-bag'
  if (/bandana|pet-/i.test(slug) || tab === 'pets') return 'pets'
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
  return false
}

function isSkin(r, g, b) {
  return r > 95 && g > 45 && b > 35 && r > g + 12 && g > b
}

function isLeatherPixel(r, g, b) {
  const spread = Math.max(r, g, b) - Math.min(r, g, b)
  const lum = 0.299 * r + 0.587 * g + 0.114 * b
  return spread < 42 && lum > 35 && lum < 135 && r >= g && b < g + 10
}

function isStrapOrZipper(r, g, b) {
  const lum = 0.299 * r + 0.587 * g + 0.114 * b
  if (lum < 42) return true
  if (lum < 75 && Math.abs(r - g) < 12 && Math.abs(g - b) < 18) return true
  return false
}

async function loadPixels(publicPath) {
  const file = path.join(ROOT, 'public', publicPath.replace(/^\//, ''))
  if (!existsSync(file)) return null
  const img = sharp(file)
  const { width, height } = await img.metadata()
  if (!width || !height) return null
  const { data, info } = await img.ensureAlpha().raw().toBuffer({ resolveWithObject: true })
  return { width, height, data, channels: info.channels }
}

function cellStats(px, gx, gy, type) {
  const { width, height, data, channels } = px
  const x0 = Math.floor((gx * width) / GRID)
  const y0 = Math.floor((gy * height) / GRID)
  const x1 = Math.floor(((gx + 1) * width) / GRID)
  const y1 = Math.floor(((gy + 1) * height) / GRID)
  let n = 0
  let skin = 0
  let strap = 0
  let leather = 0
  let lum = 0
  for (let y = y0; y < y1; y++) {
    for (let x = x0; x < x1; x++) {
      const i = (y * width + x) * channels
      const r = data[i],
        g = data[i + 1],
        b = data[i + 2]
      const a = channels > 3 ? data[i + 3] : 255
      if (isBackground(r, g, b, a)) continue
      n++
      lum += 0.299 * r + 0.587 * g + 0.114 * b
      if (isSkin(r, g, b)) skin++
      if (isStrapOrZipper(r, g, b)) strap++
      if (isLeatherPixel(r, g, b)) leather++
    }
  }
  if (!n) return null
  const cx = (gx + 0.5) / GRID
  const cy = (gy + 0.5) / GRID
  return {
    cx,
    cy,
    n,
    lum: lum / n,
    skin: skin / n,
    strap: strap / n,
    leather: leather / n,
  }
}

function analyzeGrid(px, productType, slug) {
  const forbidden = new Uint8Array(GRID * GRID)
  const cells = []
  for (let gy = 0; gy < GRID; gy++) {
    for (let gx = 0; gx < GRID; gx++) {
      const s = cellStats(px, gx, gy, productType)
      if (!s) continue
      cells.push(s)
      let bad = s.skin > 0.36 || s.strap > 0.32
      if (productType === 'leather-patch-hat' && s.leather > 0.22) bad = s.strap > 0.45
      if (productType === 'pets') bad = s.skin > 0.2 || s.strap > 0.32
      if (productType === 'zip-bag' && s.cy < 0.46 && s.strap > 0.15) bad = true
      if (productType === 'bag' && (s.cy < 0.38 || s.cy > 0.86) && s.skin > 0.25) bad = true
      if (productType === 'large-flat' && s.skin > 0.28) bad = true
      if (bad) forbidden[gy * GRID + gx] = 1
    }
  }
  return { forbidden, cells }
}

/** Wordmark box must not intersect forbidden cells (skin / straps / zippers). */
function boxFitsForbidden(left, top, width, forbidden) {
  const halfW = width / 2
  const halfH = width * WORDMARK_HALF_HEIGHT_RATIO
  const points = []
  for (const dx of [-0.85, 0, 0.85]) {
    for (const dy of [-0.85, 0, 0.85]) {
      points.push([left + dx * halfW, top + dy * halfH])
    }
  }
  for (const [px, py] of points) {
    if (px < 0 || px > 1 || py < 0 || py > 1) return false
    const gx = Math.min(GRID - 1, Math.max(0, Math.floor(px * GRID)))
    const gy = Math.min(GRID - 1, Math.max(0, Math.floor(py * GRID)))
    if (forbidden[gy * GRID + gx]) return false
  }
  return true
}

function shrinkOrHide(left, top, width, forbidden, minWidth = 0.09) {
  let w = width
  while (w >= minWidth) {
    if (boxFitsForbidden(left, top, w, forbidden)) {
      return { left, top, width: w, hide: false }
    }
    w -= 0.01
  }
  return { hide: true, left: 0.5, top: 0.5, width: 0.12 }
}

function skinShare(cells) {
  let skinW = 0
  let total = 0
  for (const c of cells) {
    skinW += c.skin * c.n
    total += c.n
  }
  return total ? skinW / total : 0
}

function isChestGarment(productType, slug) {
  if (productType === 'leather-patch-hat' || productType === 'mug' || productType === 'large-flat') return false
  if (productType === 'apparel' || productType === 'hoodie' || productType === 'sweatshirt') return true
  if (/tee|tank|sweat|crewneck|polo|hoodie|jersey|raglan|long-sleeve/i.test(slug)) return true
  return false
}

function clampChestGarmentPlacement(productType, slug, p, printPosition) {
  if (!p || p.hide || !isChestGarment(productType, slug)) return p
  const seed = categorySeed(productType, slug, printPosition)
  return {
    ...p,
    top: seed.top,
    left: seed.left,
    width: Math.min(Math.max(p.width, seed.width * 0.9), seed.width * 1.1),
  }
}

function categorySeed(productType, slug, printPosition) {
  if (printPosition?.x != null && printPosition?.y != null) {
    return {
      left: printPosition.x,
      top: printPosition.y,
      width: Math.min(0.5, Math.max(0.14, (printPosition.scale ?? 0.38) * 0.58)),
    }
  }
  if (productType === 'leather-patch-hat') return { left: 0.48, top: 0.34, width: 0.14 }
  if (productType === 'zip-bag') return { left: 0.5, top: 0.67, width: 0.17 }
  if (productType === 'bag') return { left: 0.44, top: 0.58, width: 0.16 }
  if (productType === 'hat' && /beanie/i.test(slug)) return { left: 0.5, top: 0.34, width: 0.14 }
  if (productType === 'hat') return { left: 0.5, top: 0.19, width: 0.2 }
  if (productType === 'mug') return { left: 0.5, top: 0.46, width: 0.44 }
  if (productType === 'large-flat') return { left: 0.5, top: 0.46, width: 0.45 }
  if (productType === 'pets') return { left: 0.5, top: 0.62, width: 0.28 }
  return { left: 0.5, top: 0.44, width: 0.28 }
}

function refinePlacement(seed, forbidden, productType, minWidth = 0.09) {
  const deltas = [0, -0.02, 0.02, -0.04, 0.04, -0.06, 0.06]
  let best = null
  for (const dt of deltas) {
    for (const dl of deltas) {
      const left = seed.left + dl
      const top = seed.top + dt
      const fit = shrinkOrHide(left, top, seed.width, forbidden, minWidth)
      if (!fit.hide) {
        best = fit
        break
      }
    }
    if (best) break
  }
  return best ?? shrinkOrHide(seed.left, seed.top, seed.width, forbidden, minWidth)
}

function placementSkinOverlap(left, top, width, cells) {
  const halfW = width / 2
  const halfH = width * WORDMARK_HALF_HEIGHT_RATIO
  let skinW = 0
  let n = 0
  for (const c of cells) {
    if (Math.abs(c.cx - left) <= halfW + 0.06 && Math.abs(c.cy - top) <= halfH + 0.08) {
      skinW += c.skin * c.n
      n += c.n
    }
  }
  return n ? skinW / n : 0
}

function detectLeatherPatch(cells) {
  const patchCells = cells.filter((c) => c.leather > 0.16 && c.skin < 0.22 && c.cy < 0.4 && c.cy > 0.1)
  if (!patchCells.length) return null
  const half = 0.5 / GRID
  let minX = 1
  let maxX = 0
  let minY = 1
  let maxY = 0
  for (const c of patchCells) {
    minX = Math.min(minX, c.cx - half)
    maxX = Math.max(maxX, c.cx + half)
    minY = Math.min(minY, c.cy - half)
    maxY = Math.max(maxY, c.cy + half)
  }
  const left = (minX + maxX) / 2
  const top = (minY + maxY) / 2
  const patchW = Math.max(0.06, maxX - minX)
  const width = Math.min(0.22, Math.max(0.08, patchW * 0.7))
  return { left, top, width, inkBlankKind: 'dark' }
}

/** Lifestyle / model / pet shots: center on fabric, not fur or skin. */
function detectLifestyleFabric(slug, cells, forbidden) {
  const petBandana = /bandana/i.test(slug)
  const minCy = petBandana ? 0.5 : 0.32
  const maxCy = petBandana ? 0.92 : 0.78
  const candidates = cells.filter(
    (c) =>
      c.cy >= minCy &&
      c.cy <= maxCy &&
      c.skin < 0.18 &&
      c.strap < 0.34 &&
      (petBandana ? c.leather < 0.2 : true)
  )
  if (!candidates.length) return null
  let sumX = 0
  let sumY = 0
  let n = 0
  for (const c of candidates) {
    const w = c.n * (1 - c.skin)
    sumX += c.cx * w
    sumY += c.cy * w
    n += w
  }
  if (!n) return null
  const left = sumX / n
  const top = sumY / n
  const xs = candidates.map((c) => c.cx)
  const ys = candidates.map((c) => c.cy)
  const spreadX = Math.max(...xs) - Math.min(...xs)
  const spreadY = Math.max(...ys) - Math.min(...ys)
  const spread = Math.max(spreadX, spreadY * 1.4, 0.14)
  const width = Math.min(0.42, Math.max(0.16, spread * (petBandana ? 0.72 : 0.65)))
  const fit = shrinkOrHide(left, top, width, forbidden, petBandana ? 0.12 : 0.14)
  return fit.hide ? null : fit
}

function bboxFromPrintableCells(cells) {
  const ok = cells.filter((c) => c.skin < 0.22 && c.strap < 0.34)
  if (!ok.length) return null
  let minX = 1
  let maxX = 0
  let minY = 1
  let maxY = 0
  let n = 0
  for (const c of ok) {
    const half = 0.5 / GRID
    minX = Math.min(minX, c.cx - half)
    maxX = Math.max(maxX, c.cx + half)
    minY = Math.min(minY, c.cy - half)
    maxY = Math.max(maxY, c.cy + half)
    n += c.n
  }
  if (!n) return null
  return {
    cx: (minX + maxX) / 2,
    cy: (minY + maxY) / 2,
    w: maxX - minX,
    h: maxY - minY,
  }
}

/** Multi-bottle lifestyle: center mark on brightest center column (white bottle body). */
function detectCenterBrightProduct(cells, forbidden) {
  const cols = cells.filter(
    (c) => c.cx >= 0.4 && c.cx <= 0.6 && c.cy >= 0.28 && c.cy <= 0.72 && c.skin < 0.2 && c.strap < 0.34
  )
  if (cols.length < 4) return null
  let best = null
  for (const c of cols) {
    const score = c.lum * c.n * (1 - c.skin)
    if (!best || score > best.score) best = { cx: c.cx, cy: c.cy, lum: c.lum, score }
  }
  if (!best) return null
  const width = 0.26
  const fit = shrinkOrHide(best.cx, best.cy, width, forbidden, 0.12)
  if (fit.hide) return null
  return { ...fit, inkBlankKind: best.lum > 145 ? 'dark' : 'light' }
}

function seedLargePrintArea(cells, forbidden) {
  const bbox = bboxFromPrintableCells(cells)
  if (!bbox) return null
  const area = Math.min(bbox.w, bbox.h * 0.85)
  const width = Math.min(0.52, Math.max(0.32, area * 0.45))
  const fit = shrinkOrHide(bbox.cx, bbox.cy, width, forbidden, Math.max(0.28, width * 0.72))
  return fit.hide ? null : fit
}

function nudgeLeatherCenter(left, top, width, forbidden) {
  const deltas = [0, -0.015, 0.015, -0.03, 0.03]
  for (const dl of deltas) {
    for (const dt of deltas) {
      const fit = shrinkOrHide(left + dl, top + dt, width, forbidden, width * 0.82)
      if (!fit.hide) return fit
    }
  }
  return shrinkOrHide(left, top, width, forbidden, 0.07)
}

function findBestPrintCell(cells, forbidden, productType) {
  const width =
    productType === 'mug' || productType === 'large-flat'
      ? 0.32
      : productType === 'hoodie' || productType === 'apparel'
        ? 0.22
        : 0.16
  let best = null
  for (const c of cells) {
    if (c.skin > 0.1 || c.strap > 0.3) continue
    if (productType === 'hoodie' && (c.cy < 0.36 || c.cy > 0.72)) continue
    if (productType === 'hat' && c.cy > 0.42) continue
    if (!boxFitsForbidden(c.cx, c.cy, width, forbidden)) continue
    const score = (1 - c.skin) * c.n
    if (!best || score > best.score) {
      best = { left: c.cx, top: c.cy, width, score }
    }
  }
  return best
}

/** When inference would hide every slide, pick flat product placement (print-area seed, no lifestyle heuristics). */
async function inferSafeFlatPlacement(slug, productType, src, printPosition) {
  const px = await loadPixels(src)
  if (!px) return { hide: true, top: 0.5, left: 0.5, width: 0.12 }

  const { forbidden, cells } = analyzeGrid(px, productType, slug)
  const seed = categorySeed(productType, slug, printPosition)
  const minW = productType === 'mug' || productType === 'large-flat' ? 0.28 : 0.09
  let fit = refinePlacement(seed, forbidden, productType, minW)
  if (fit.hide) {
    const cell = findBestPrintCell(cells, forbidden, productType)
    if (cell) fit = { left: cell.left, top: cell.top, width: cell.width, hide: false }
  }
  if (fit.hide) return fit
  if (placementSkinOverlap(fit.left, fit.top, fit.width, cells) > 0.16) {
    return { hide: true, top: 0.5, left: 0.5, width: 0.12 }
  }
  return fit
}

async function skinForGallerySrc(slug, productType, src) {
  const px = await loadPixels(src)
  if (!px) return 1
  const { cells } = analyzeGrid(px, productType, slug)
  return skinShare(cells)
}

/** Prefer hiding the slide with more visible skin (lifestyle), keep flat product visible when possible. */
async function rebalanceTwoSlideHides(item, productType, slides) {
  const gallery = item.gallery ?? []
  if (gallery.length !== 2) return
  const ov0 = overrides[item.slug]?.slides?.[0]
  const ov1 = overrides[item.slug]?.slides?.[1]
  if (ov0?.hide || ov1?.hide) return
  if (!slides[0]?.hide || slides[1]?.hide) return
  const skin0 = await skinForGallerySrc(item.slug, productType, gallery[0])
  const skin1 = await skinForGallerySrc(item.slug, productType, gallery[1])
  if (skin1 <= skin0 && skin0 > 0.05) return
  if (skin0 < 0.045 && skin0 <= skin1) {
    /* flat product on slide 0 */
  } else if (skin1 <= skin0 + 0.008) return
  const flat = await inferSafeFlatPlacement(item.slug, productType, gallery[0], item.printArea?.position)
  if (flat.hide) return
  slides[0] = roundPlacement(flat)
  slides[1] = { hide: true }
}

async function salvageAllHiddenSlides(item, productType, slides) {
  const gallery = item.gallery ?? []
  if (!gallery.length) return
  const tryOrder = []
  for (let i = gallery.length - 1; i >= 0; i--) tryOrder.push(i)
  for (let i = 0; i < gallery.length; i++) {
    if (!tryOrder.includes(i)) tryOrder.push(i)
  }
  for (const i of tryOrder) {
    const placement = await inferSafeFlatPlacement(
      item.slug,
      productType,
      gallery[i],
      item.printArea?.position
    )
    if (!placement.hide) {
      slides[i] = roundPlacement(placement)
      return
    }
  }
  console.warn(`Could not salvage visible placement: ${item.slug}`)
}

async function inferPlacementForSlide(slug, productType, src, printPosition) {
  const px = await loadPixels(src)
  if (!px) return { hide: true, top: 0.5, left: 0.5, width: 0.12 }

  const { forbidden, cells } = analyzeGrid(px, productType, slug)
  const lifestyle = skinShare(cells) > 0.07

  if (productType === 'leather-patch-hat') {
    const patch = detectLeatherPatch(cells)
    if (patch) {
      const skinAtPatch = placementSkinOverlap(patch.left, patch.top, patch.width, cells)
      if (skinAtPatch > 0.1 || patch.top > 0.38) {
        return { hide: true, top: 0.5, left: 0.5, width: 0.12 }
      }
      return {
        left: patch.left,
        top: patch.top,
        width: patch.width,
        inkBlankKind: patch.inkBlankKind,
      }
    }
    return { hide: true, top: 0.5, left: 0.5, width: 0.12 }
  }

  if (/bandana/i.test(slug)) {
    const fabric = detectLifestyleFabric(slug, cells, forbidden)
    if (fabric) return fabric
    const bbox = bboxFromPrintableCells(cells)
    if (bbox) {
      const flatLay = bbox.w > 0.55 && bbox.h > 0.55
      const width = flatLay ? 0.36 : Math.min(0.42, Math.max(0.2, bbox.w * 0.52))
      if (flatLay) {
        return { left: bbox.cx, top: bbox.cy, width }
      }
      const fit = shrinkOrHide(bbox.cx, bbox.cy, width, forbidden, 0.16)
      if (!fit.hide) return fit
    }
  }

  const chest = isChestGarment(productType, slug)
  if (chest && lifestyle && skinShare(cells) > 0.04) {
    const seed = categorySeed(productType, slug, printPosition)
    const fit = refinePlacement(seed, forbidden, productType, seed.width * 0.85)
    if (!fit.hide && placementSkinOverlap(fit.left, fit.top, fit.width, cells) < 0.12) {
      return clampChestGarmentPlacement(productType, slug, fit, printPosition)
    }
    return { hide: true, top: 0.5, left: 0.5, width: 0.12 }
  }

  if (!chest && (lifestyle || productType === 'pets')) {
    const fabric = detectLifestyleFabric(slug, cells, forbidden)
    if (fabric) return fabric
  }

  if (productType === 'large-flat') {
    const large = seedLargePrintArea(cells, forbidden)
    if (large) return large
  }

  if (productType === 'mug' || /bottle/i.test(slug)) {
    const center = detectCenterBrightProduct(cells, forbidden)
    if (center) return center
    const large = seedLargePrintArea(cells, forbidden)
    if (large) return large
  }

  const seed = categorySeed(productType, slug, printPosition)
  const minW = productType === 'mug' || productType === 'large-flat' ? 0.3 : 0.09
  const fit = refinePlacement(seed, forbidden, productType, minW)
  const done = fit.hide ? { hide: true, top: 0.5, left: 0.5, width: 0.12 } : fit
  return clampChestGarmentPlacement(productType, slug, done, printPosition)
}

function roundPlacement(p) {
  if (p.hide) return { hide: true }
  const out = {
    top: Math.round(p.top * 1000) / 1000,
    left: Math.round(p.left * 1000) / 1000,
    width: Math.round(p.width * 1000) / 1000,
  }
  if (p.scale != null) out.scale = Math.round(p.scale * 1000) / 1000
  if (p.rotate != null) out.rotate = Math.round(p.rotate * 10) / 10
  if (p.hide) out.hide = true
  if (p.inkBlankKind) out.inkBlankKind = p.inkBlankKind
  if (p.wordmarkStyle) out.wordmarkStyle = p.wordmarkStyle
  return out
}

const overrides = existsSync(OVERRIDES)
  ? JSON.parse(readFileSync(OVERRIDES, 'utf8')).bySlug ?? {}
  : {}

const catalog = JSON.parse(readFileSync(CATALOG, 'utf8'))
const bySlug = {}
let hidden = 0

for (const item of catalog.items) {
  const productType = inferProductType(item.slug, item.productType, item.tab)
  const slides = []
  const gallery = item.gallery ?? []
  for (let i = 0; i < gallery.length; i++) {
    const src = gallery[i]
    const ov = overrides[item.slug]?.slides?.[i]
    if (ov) {
      slides.push(roundPlacement(ov))
      if (ov.hide) hidden++
      continue
    }
    let placement = await inferPlacementForSlide(item.slug, productType, src, item.printArea?.position)
    placement = clampChestGarmentPlacement(productType, item.slug, placement, item.printArea?.position)
    slides.push(roundPlacement(placement))
    if (placement.hide) hidden++
  }

  await rebalanceTwoSlideHides(item, productType, slides)
  if (slides.length && slides.every((s) => s.hide)) {
    await salvageAllHiddenSlides(item, productType, slides)
    if (!slides.every((s) => s.hide)) hidden--
  }
  bySlug[item.slug] = { slides }
}

writeFileSync(OUT, JSON.stringify({ version: 2, generatedAt: new Date().toISOString(), bySlug }, null, 2) + '\n')
console.log(`Wrote ${Object.keys(bySlug).length} items (${hidden} hidden slides) → ${path.relative(ROOT, OUT)}`)
