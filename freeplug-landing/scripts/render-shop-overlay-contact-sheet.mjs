#!/usr/bin/env node
/**
 * Build overlay QA contact sheets (grid cards + PDP heroes).
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

mkdirSync(ARTIFACTS, { recursive: true })

const catalog = JSON.parse(
  readFileSync(path.join(ROOT, 'src/lib/merch/shop/shop-catalog.json'), 'utf8')
)
const slugs = catalog.items.map((i) => i.slug)

const browser = await chromium.launch()
const page = await browser.newPage({ viewport: { width: 1280, height: 900 } })

await page.goto(`${base}/shop`, { waitUntil: 'networkidle', timeout: 180_000 })
for (;;) {
  const btn = page.getByRole('button', { name: 'Show more' })
  if (!(await btn.count())) break
  await btn.click()
  await page.waitForTimeout(350)
}

await page.screenshot({ path: path.join(ARTIFACTS, 'shop-grid-overlay-full-1280.png'), fullPage: true })

const cardShots = []
const lis = page.locator('ul.grid li')
const total = await lis.count()
for (let i = 0; i < total; i++) {
  const li = lis.nth(i)
  await li.scrollIntoViewIfNeeded()
  const buf = await li.screenshot({ type: 'png' })
  cardShots.push(buf)
}

async function stitchGrid(buffers, cols, outPath, cell = 280) {
  const rows = Math.ceil(buffers.length / cols)
  const sheet = sharp({
    create: {
      width: cols * cell,
      height: rows * cell,
      channels: 3,
      background: { r: 245, g: 245, b: 245 },
    },
  })
  const composites = buffers.map((buf, idx) => ({
    input: buf,
    top: Math.floor(idx / cols) * cell,
    left: (idx % cols) * cell,
  }))
  await sheet.composite(composites).png().toFile(outPath)
}

await stitchGrid(cardShots.slice(0, 100), 10, path.join(ARTIFACTS, 'shop-overlay-contact-grid-page1.png'))
await stitchGrid(cardShots.slice(100), 10, path.join(ARTIFACTS, 'shop-overlay-contact-grid-page2.png'))

for (const slug of CHEKE_SLUGS) {
  await page.goto(`${base}/shop/${slug}`, { waitUntil: 'networkidle', timeout: 120_000 })
  await page.locator('.aspect-square').first().screenshot({
    path: path.join(ARTIFACTS, `pdp-overlay-${slug}.png`),
  })
}

const pdpShots = []
for (let si = 0; si < slugs.length; si++) {
  const slug = slugs[si]
  process.stdout.write(`PDP ${si + 1}/${slugs.length}\r`)
  await page.goto(`${base}/shop/${slug}?wordmark_brand=freeplug-dev&wordmark_style=cursive`, {
    waitUntil: 'networkidle',
    timeout: 120_000,
  })
  await page.waitForTimeout(150)
  const buf = await page.locator('.aspect-square').first().screenshot({ type: 'png' })
  pdpShots.push(buf)
}

await stitchGrid(pdpShots.slice(0, 65), 13, path.join(ARTIFACTS, 'shop-overlay-contact-pdp-page1.png'), 220)
await stitchGrid(pdpShots.slice(65, 130), 13, path.join(ARTIFACTS, 'shop-overlay-contact-pdp-page2.png'), 220)
await stitchGrid(pdpShots.slice(130), 13, path.join(ARTIFACTS, 'shop-overlay-contact-pdp-page3.png'), 220)

await browser.close()
console.log(`\nContact sheets → ${ARTIFACTS}`)
