/**
 * Classify each shop blank WebP as light vs dark garment (chest ROI dark-pixel ratio).
 * Updates shop-catalog.json `galleryBlankKinds` per item. Run after blanks change.
 */
import { existsSync, readFileSync, writeFileSync } from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import sharp from 'sharp'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const ROOT = path.join(__dirname, '..')
const CATALOG = path.join(ROOT, 'src/lib/merch/shop/shop-catalog.json')
const DARK_FRAC_MIN = 0.06

function roiForSlug(slug) {
  if (/beanie|cap|hat|visor/i.test(slug)) {
    return { left: 0.28, top: 0.08, w: 0.44, h: 0.34 }
  }
  if (/tote|bag|backpack|duffel/i.test(slug)) {
    return { left: 0.22, top: 0.38, w: 0.56, h: 0.42 }
  }
  return { left: 0.2, top: 0.15, w: 0.6, h: 0.55 }
}

async function classifyBlankWebp(publicPath, slug) {
  const file = path.join(ROOT, 'public', publicPath.replace(/^\//, ''))
  if (!existsSync(file)) return 'light'
  const img = sharp(file)
  const { width, height } = await img.metadata()
  if (!width || !height) return 'light'
  const roi = roiForSlug(slug)
  const left = Math.floor(width * roi.left)
  const top = Math.floor(height * roi.top)
  const w = Math.floor(width * roi.w)
  const h = Math.floor(height * roi.h)
  const { data, info } = await img.extract({ left, top, width: w, height: h }).raw().toBuffer({ resolveWithObject: true })
  let dark = 0
  let n = 0
  for (let i = 0; i < data.length; i += info.channels) {
    const lum = 0.299 * data[i] + 0.587 * data[i + 1] + 0.114 * data[i + 2]
    n++
    if (lum < 72) dark++
  }
  return dark / n >= DARK_FRAC_MIN ? 'dark' : 'light'
}

const catalog = JSON.parse(readFileSync(CATALOG, 'utf8'))
let updated = 0
for (const item of catalog.items) {
  const kinds = []
  for (const src of item.gallery ?? []) {
    kinds.push(await classifyBlankWebp(src, item.slug))
  }
  if (kinds.length) {
    item.galleryBlankKinds = kinds
    updated++
  }
}
writeFileSync(CATALOG, JSON.stringify(catalog, null, 0))
console.log(`galleryBlankKinds on ${updated} items`)
