#!/usr/bin/env node
/**
 * Live PDP overlay visibility: overlay on vs ?shop_wordmark_overlay=0.
 * Writes shop-overlay-visibility-report.json and exits 1 on any failure.
 *
 * Usage:
 *   BASE_URL=http://127.0.0.1:3013 node scripts/audit-shop-overlay-visibility.mjs
 *   BASE_URL=... node scripts/audit-shop-overlay-visibility.mjs slug-a slug-b
 */
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { chromium } from 'playwright'
import sharp from 'sharp'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const ROOT = path.join(__dirname, '..')
const ARTIFACTS = '/opt/cursor/artifacts'
const base = process.env.BASE_URL ?? 'http://127.0.0.1:3013'
const MIN_MARK_REGION_CHANGED = 0.06
const MIN_CONTRAST = 3
const WORDMARK_HALF_HEIGHT_RATIO = 0.22

const catalog = JSON.parse(readFileSync(path.join(ROOT, 'src/lib/merch/shop/shop-catalog.json'), 'utf8'))
const placementsDoc = JSON.parse(
  readFileSync(path.join(ROOT, 'src/lib/merch/shop/shop-gallery-placements.json'), 'utf8')
)
const noClean = new Set(
  JSON.parse(readFileSync(path.join(ROOT, 'src/lib/merch/shop/shop-no-clean-mockup.json'), 'utf8')).slugs ?? []
)
const slugs =
  process.argv.length > 2
    ? process.argv.slice(2)
    : catalog.items.map((i) => i.slug).filter((s) => !noClean.has(s))

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

function relativeLuminance(r, g, b) {
  const lin = (c) => {
    const s = c / 255
    return s <= 0.03928 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4
  }
  return 0.2126 * lin(r) + 0.7152 * lin(g) + 0.0722 * lin(b)
}

function contrastRatio(a, b) {
  const hi = Math.max(a, b)
  const lo = Math.min(a, b)
  return (hi + 0.05) / (lo + 0.05)
}

async function captureHero(page, slug, overlayOn) {
  const q = overlayOn
    ? 'wordmark_brand=freeplug-dev&wordmark_style=cursive'
    : 'wordmark_brand=freeplug-dev&wordmark_style=cursive&shop_wordmark_overlay=0'
  await page.goto(`${base}/shop/${slug}?${q}`, { waitUntil: 'load', timeout: 90_000 })
  await page.waitForTimeout(400)
  const item = catalog.items.find((i) => i.slug === slug)
  const heroIdx = item ? printableHeroSlideIndex(slug, item.gallery?.length ?? 2) : 0
  const thumbs = page.locator('button.rounded-lg.border.p-1')
  const count = await thumbs.count().catch(() => 0)
  if (count > heroIdx) await thumbs.nth(heroIdx).click({ timeout: 8000 }).catch(() => {})
  await page.waitForTimeout(450)
  const el = await page.$('[data-testid="shop-pdp-hero-mockup"]')
  if (!el) throw new Error(`no hero ${slug}`)
  return el.screenshot({ type: 'png' })
}

function placementRect(imgW, imgH, placement) {
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

function heroPlacement(slug) {
  const item = catalog.items.find((i) => i.slug === slug)
  if (!item) return null
  const idx = printableHeroSlideIndex(slug, item.gallery?.length ?? 1)
  const slide = placementsDoc.bySlug[slug]?.slides?.[idx]
  if (!slide || slide.hide) return null
  if (typeof slide.top !== 'number') return null
  return { top: slide.top, left: slide.left, width: slide.width }
}

async function diffStats(onBuf, offBuf, placement) {
  const on = await sharp(onBuf).ensureAlpha().raw().toBuffer({ resolveWithObject: true })
  const off = await sharp(offBuf)
    .resize(on.info.width, on.info.height)
    .ensureAlpha()
    .raw()
    .toBuffer({ resolveWithObject: true })
  const ch = on.info.channels
  const w = on.info.width
  const h = on.info.height
  const rect = placement ? placementRect(w, h, placement) : { x0: 0, y0: 0, x1: w, y1: h }
  const region = Math.max(1, (rect.x1 - rect.x0) * (rect.y1 - rect.y0))
  let changed = 0
  let contrastSum = 0
  for (let y = rect.y0; y < rect.y1; y++) {
    for (let x = rect.x0; x < rect.x1; x++) {
      const i = (y * w + x) * ch
      const d = Math.max(
        Math.abs(on.data[i] - off.data[i]),
        Math.abs(on.data[i + 1] - off.data[i + 1]),
        Math.abs(on.data[i + 2] - off.data[i + 2])
      )
      if (d < 14) continue
      changed++
      const lb = relativeLuminance(off.data[i], off.data[i + 1], off.data[i + 2])
      const la = relativeLuminance(on.data[i], on.data[i + 1], on.data[i + 2])
      contrastSum += contrastRatio(lb, la)
    }
  }
  const tile = w * h
  return {
    changedShare: changed / tile,
    markRegionChangedShare: changed / region,
    contrastRatio: changed ? contrastSum / changed : 0,
  }
}

mkdirSync(ARTIFACTS, { recursive: true })
const browser = await chromium.launch()
const page = await browser.newPage({ viewport: { width: 1200, height: 1000 } })
const results = []
const failures = []

for (let i = 0; i < slugs.length; i++) {
  const slug = slugs[i]
  process.stdout.write(`vis ${i + 1}/${slugs.length}\r`)
  try {
    const onBuf = await captureHero(page, slug, true)
    const offBuf = await captureHero(page, slug, false)
    const placement = heroPlacement(slug)
    const st = await diffStats(onBuf, offBuf, placement)
    const tileOk = st.changedShare >= 0.004
    const markOk = st.markRegionChangedShare >= MIN_MARK_REGION_CHANGED
    const pass = (tileOk || markOk) && st.contrastRatio >= MIN_CONTRAST
    const row = {
      slug,
      pass,
      changedShare: st.changedShare,
      markRegionChangedShare: st.markRegionChangedShare,
      contrastRatio: st.contrastRatio,
    }
    results.push(row)
    if (!pass) {
      failures.push(row)
    }
  } catch (err) {
    const row = { slug, pass: false, error: err.message }
    results.push(row)
    failures.push(row)
  }
}

await browser.close()

const report = {
  generatedAt: new Date().toISOString(),
  baseUrl: base,
  tileCount: slugs.length,
  minMarkRegionChanged: MIN_MARK_REGION_CHANGED,
  minContrast: MIN_CONTRAST,
  passed: results.filter((r) => r.pass).length,
  failed: failures.length,
  results,
}
writeFileSync(path.join(ARTIFACTS, 'shop-overlay-visibility-report.json'), JSON.stringify(report, null, 2) + '\n')

console.log(`\n${report.passed}/${report.tileCount} passed → ${path.join(ARTIFACTS, 'shop-overlay-visibility-report.json')}`)
if (failures.length) {
  for (const f of failures.slice(0, 40)) {
    if (f.error) console.error(` ${f.slug}: ${f.error}`)
    else
      console.error(
        ` ${f.slug}: tile=${(f.changedShare * 100).toFixed(2)}% mark=${((f.markRegionChangedShare ?? 0) * 100).toFixed(0)}% contrast=${f.contrastRatio.toFixed(2)}`
      )
  }
  if (failures.length > 40) console.error(` ... +${failures.length - 40} more`)
  process.exit(1)
}
