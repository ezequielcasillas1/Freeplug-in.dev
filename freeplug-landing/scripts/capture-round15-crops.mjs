#!/usr/bin/env node
/**
 * Round 15: real buyer PDP hero (default overlay) or grid-absence for hidden slugs.
 * Output: /opt/cursor/artifacts/round15-crop-<slug>.png
 */
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import path from 'node:path'
import sharp from 'sharp'
import { chromium } from 'playwright'

const ARTIFACTS = '/opt/cursor/artifacts'
const ROOT = process.cwd()
const base = process.env.BASE_URL ?? 'http://127.0.0.1:3013'
const CELL_W = 380
const CELL_H = 420
const LABEL_H = 40

const SLUGS = [
  'circle-necklace-engraving-2341',
  'heart-necklace-engraving-2655',
  'horizontal-bar-necklace-engraving-2654',
  'cutout-heart-bar-necklace-engraving-2659',
  'cutout-paw-bar-necklace-engraving-2652',
  'clip-on-pet-bandana-1672',
  'posicharge-competitor-7-pocketed-short-4616',
  'snapback-trucker-cap-1446',
]

const noClean = new Set(
  JSON.parse(readFileSync(path.join(ROOT, 'src/lib/merch/shop/shop-no-clean-mockup.json'), 'utf8')).slugs ?? []
)

async function textSvg(slug, subtitle) {
  const t1 = slug.replace(/&/g, '&amp;')
  const t2 = subtitle.replace(/&/g, '&amp;')
  const svg = `<svg width="360" height="40">
  <text x="0" y="14" fill="white" font-family="monospace" font-size="10">${t1}</text>
  <text x="0" y="32" fill="#fca5a5" font-family="monospace" font-size="10">${t2}</text>
</svg>`
  return sharp(Buffer.from(svg)).png().toBuffer()
}

async function labelTile(heroPng, slug, subtitle) {
  const hero = await sharp(heroPng)
    .resize(CELL_W, CELL_H - LABEL_H, { fit: 'contain', background: '#f4f4f5' })
    .png()
    .toBuffer()
  return sharp(hero)
    .extend({ top: 0, bottom: LABEL_H, left: 0, right: 0, background: '#18181b' })
    .composite([{ input: await textSvg(slug, subtitle), top: CELL_H - LABEL_H + 2, left: 8 }])
    .png()
    .toBuffer()
}

mkdirSync(ARTIFACTS, { recursive: true })
const browser = await chromium.launch()
const page = await browser.newPage({ viewport: { width: 1280, height: 900 } })

for (const slug of SLUGS) {
  const out = path.join(ARTIFACTS, `round15-crop-${slug}.png`)
  if (noClean.has(slug)) {
    await page.goto(`${base}/shop`, { waitUntil: 'networkidle', timeout: 90_000 })
    await page.waitForTimeout(800)
    const onGrid = await page.locator(`a[href*="/shop/${slug}"]`).count()
    const shot = await page.screenshot({ type: 'png', fullPage: false })
    const annotated = await sharp(shot)
      .resize(CELL_W, CELL_H - LABEL_H, { fit: 'cover', position: 'top' })
      .png()
      .toBuffer()
    const tile = await labelTile(
      annotated,
      slug,
      onGrid === 0 ? 'HIDDEN — not on /shop grid (no-clean)' : `WARN: still ${onGrid} grid link(s)`
    )
    writeFileSync(out, tile)
    console.log(`hidden ${slug} gridLinks=${onGrid} → ${out}`)
    continue
  }

  await page.goto(
    `${base}/shop/${slug}?wordmark_brand=freeplug-dev&wordmark_style=cursive`,
    { waitUntil: 'load', timeout: 90_000 }
  )
  await page.waitForTimeout(700)
  const heroSrc = await page.evaluate(() => {
    const root = document.querySelector('[data-testid="shop-pdp-hero-mockup"]')
    const img = root?.querySelector('img')
    return img?.getAttribute('src') ?? ''
  })
  const el = await page.$('[data-testid="shop-pdp-hero-mockup"]')
  if (!el) throw new Error(`no hero ${slug}`)
  const shot = await el.screenshot({ type: 'png' })
  const shortSrc = heroSrc.split('/').slice(-2).join('/')
  const tile = await labelTile(shot, slug, `PDP hero (${shortSrc})`)
  writeFileSync(out, tile)
  console.log(`pdp ${slug} hero=${shortSrc} → ${out}`)
}

await browser.close()
console.log(`Done ${SLUGS.length} round15 crops → ${ARTIFACTS}`)
