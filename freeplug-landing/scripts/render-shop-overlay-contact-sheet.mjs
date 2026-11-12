#!/usr/bin/env node
/**
 * PDP/grid overlay QA sheets — full hero mockup + visible overlay + slug label (~40 tiles/page).
 * Usage: BASE_URL=http://127.0.0.1:3013 node scripts/render-shop-overlay-contact-sheet.mjs
 */
import { mkdirSync, readFileSync } from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { chromium } from 'playwright'
import sharp from 'sharp'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const ROOT = path.join(__dirname, '..')
const ARTIFACTS = '/opt/cursor/artifacts'
const base = process.env.BASE_URL ?? 'http://127.0.0.1:3013'

const CHEKE_SLUGS = [
  'cotton-canvas-tote-bag-1313',
  'canvas-tote-bag-5-color-straps-507',
  'zippered-canvas-tote-1990',
  'tote-bag-aop-1389',
  'action-snapback-cap-5284',
  'dad-hat-with-leather-patch-rectangle-1221',
  'snapback-trucker-cap-1743',
  'mid-profile-baseball-cap-with-leather-patch-rect-2707',
  'classic-cuffed-beanie-embroidery-1691',
]

const COLS = 5
const PER_PAGE = 40
const CELL_W = 380
const CELL_H = 420
const LABEL_H = 36

mkdirSync(ARTIFACTS, { recursive: true })

const catalog = JSON.parse(
  readFileSync(path.join(ROOT, 'src/lib/merch/shop/shop-catalog.json'), 'utf8')
)
const placementsDoc = JSON.parse(
  readFileSync(path.join(ROOT, 'src/lib/merch/shop/shop-gallery-placements.json'), 'utf8')
)

/** First non-hidden slide with printable coords (matches buyer PDP hero). */
function printableHeroSlideIndex(slug, galleryLength) {
  const slides = placementsDoc.bySlug[slug]?.slides
  if (!slides?.length) return 0
  for (let i = 0; i < galleryLength; i++) {
    const s = slides[i]
    if (!s || s.hide) continue
    if (typeof s.top === 'number' && typeof s.left === 'number' && typeof s.width === 'number') return i
  }
  for (let i = 0; i < galleryLength; i++) {
    if (slides[i] && !slides[i].hide) return i
  }
  return 0
}

const slugs = catalog.items.map((i) => i.slug)

async function slugLabelSvg(slug, width) {
  const short = slug.length > 42 ? `${slug.slice(0, 40)}…` : slug
  const esc = short.replace(/&/g, '&amp;').replace(/</g, '&lt;')
  return Buffer.from(
    `<svg width="${width}" height="${LABEL_H}" xmlns="http://www.w3.org/2000/svg">
      <rect width="100%" height="100%" fill="#ebebeb"/>
      <text x="6" y="24" font-family="ui-monospace, monospace" font-size="11" fill="#111">${esc}</text>
    </svg>`
  )
}

async function makeTile(heroBuf, slug) {
  const imgH = CELL_H - LABEL_H
  const fitted = await sharp(heroBuf)
    .resize(CELL_W - 12, imgH - 12, { fit: 'inside', background: { r: 244, g: 244, b: 245 } })
    .png()
    .toBuffer()
  const meta = await sharp(fitted).metadata()
  const label = await slugLabelSvg(slug, CELL_W)
  const left = Math.floor((CELL_W - (meta.width ?? CELL_W)) / 2)
  return sharp({
    create: {
      width: CELL_W,
      height: CELL_H,
      channels: 3,
      background: { r: 245, g: 245, b: 245 },
    },
  })
    .composite([
      { input: fitted, top: 6, left },
      { input: label, top: imgH, left: 0 },
    ])
    .png()
    .toBuffer()
}

async function stitchPages(tiles, prefix) {
  for (let p = 0; p * PER_PAGE < tiles.length; p++) {
    const chunk = tiles.slice(p * PER_PAGE, (p + 1) * PER_PAGE)
    const rows = Math.ceil(chunk.length / COLS)
    const sheet = sharp({
      create: {
        width: COLS * CELL_W,
        height: rows * CELL_H,
        channels: 3,
        background: { r: 235, g: 235, b: 235 },
      },
    })
    const composites = chunk.map((tile, idx) => ({
      input: tile,
      top: Math.floor(idx / COLS) * CELL_H,
      left: (idx % COLS) * CELL_W,
    }))
    await sheet.composite(composites).png().toFile(path.join(ARTIFACTS, `${prefix}-page${p + 1}.png`))
  }
}

const browser = await chromium.launch()
const page = await browser.newPage({ viewport: { width: 1200, height: 1000 } })

async function capturePdpHero(slug) {
  await page.goto(`${base}/shop/${slug}?wordmark_brand=freeplug-dev&wordmark_style=cursive`, {
    waitUntil: 'load',
    timeout: 90_000,
  })
  await page.waitForLoadState('networkidle', { timeout: 20_000 }).catch(() => {})
  await page
    .waitForFunction(
      () => Boolean(document.querySelector('[data-testid="shop-pdp-hero-mockup"] svg, [data-testid="shop-pdp-hero-mockup"] img')),
      { timeout: 45_000 }
    )
    .catch(() => {})
  await page.waitForTimeout(400)
  const item = catalog.items.find((i) => i.slug === slug)
  const heroIdx = item ? printableHeroSlideIndex(slug, item.gallery?.length ?? 2) : 0
  {
    const thumbs = page.locator('button.rounded-lg.border.p-1')
    const count = await thumbs.count().catch(() => 0)
    if (count > heroIdx) {
      const btn = thumbs.nth(heroIdx)
      if (!(await btn.isDisabled().catch(() => true))) {
        await btn.click({ timeout: 8000 }).catch(() => {})
        await page.waitForTimeout(450)
      }
    }
  }
  const el = await page.$('[data-testid="shop-pdp-hero-mockup"]')
  if (!el) throw new Error(`hero missing: ${slug}`)
  return el.screenshot({ type: 'png' })
}

for (const slug of CHEKE_SLUGS) {
  try {
    const buf = await capturePdpHero(slug)
    await sharp(buf).png().toFile(path.join(ARTIFACTS, `pdp-overlay-${slug}.png`))
  } catch (err) {
    console.warn(`Skip checke ${slug}:`, err.message)
  }
}

const pdpTiles = []
for (let si = 0; si < slugs.length; si++) {
  const slug = slugs[si]
  process.stdout.write(`PDP ${si + 1}/${slugs.length}\r`)
  try {
    const hero = await capturePdpHero(slug)
    pdpTiles.push(await makeTile(hero, slug))
  } catch (err) {
    console.warn(`\nSkip ${slug}:`, err.message)
  }
}

await stitchPages(pdpTiles, 'shop-overlay-contact-pdp')

await browser.close()
console.log(`\nContact sheets (${pdpTiles.length} PDP tiles, ${CHEKE_SLUGS.length} named PDPs) → ${ARTIFACTS}`)
