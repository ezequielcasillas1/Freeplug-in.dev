#!/usr/bin/env node
/** PDP shots: leather-patch hats, pet bandana, refreshed grids. */
import { mkdirSync } from 'node:fs'
import path from 'node:path'
import { chromium } from 'playwright'

const base = process.env.BASE_URL ?? 'http://127.0.0.1:3013'
const ARTIFACTS = '/opt/cursor/artifacts'

const PDP_SLUGS = [
  ['dad-hat-with-leather-patch-rectangle-1221', 'pdp-leather-patch-dad-hat-with-leather-patch-rectangle-1221.png'],
  ['dad-hat-with-leather-patch-round-1287', 'pdp-leather-patch-dad-hat-with-leather-patch-round-1287.png'],
  [
    'mid-profile-baseball-cap-with-leather-patch-rect-2707',
    'pdp-leather-patch-mid-profile-baseball-cap-with-leather-patch-rect-2707.png',
  ],
  ['pet-bandana-562', 'pdp-pet-bandana-562.png'],
]

mkdirSync(ARTIFACTS, { recursive: true })
const browser = await chromium.launch()

async function shotPdp(slug, fileName) {
  const page = await browser.newPage({ viewport: { width: 1200, height: 1000 } })
  await page.goto(`${base}/shop/${slug}`, { waitUntil: 'load', timeout: 90_000 })
  await page.waitForLoadState('networkidle', { timeout: 25_000 }).catch(() => {})
  await page.waitForFunction(
    () => Boolean(document.querySelector('[data-testid="shop-pdp-hero-mockup"]')),
    { timeout: 45_000 }
  )
  const el = await page.$('[data-testid="shop-pdp-hero-mockup"]')
  if (!el) {
    await page.screenshot({ path: path.join(ARTIFACTS, `debug-${slug}.png`), fullPage: true })
    await page.close()
    throw new Error(`hero missing: ${slug}`)
  }
  await el.screenshot({ path: path.join(ARTIFACTS, fileName) })
  await page.close()
}

for (const [slug, fileName] of PDP_SLUGS) {
  await shotPdp(slug, fileName)
}

const gridPage = await browser.newPage({ viewport: { width: 1280, height: 900 } })
for (const locale of ['', '/es']) {
  await gridPage.goto(`${base}${locale}/shop`, { waitUntil: 'load', timeout: 90_000 })
  for (;;) {
    const btn = gridPage.getByRole('button', { name: /Show more|Mostrar más/i })
    if (!(await btn.count())) break
    await btn.click()
    await gridPage.waitForTimeout(400)
  }
  await gridPage.screenshot({
    path: path.join(ARTIFACTS, `shop-grid-${locale ? 'es' : 'en'}-placement-fix-1280.png`),
    fullPage: false,
  })
}
await gridPage.close()

await browser.close()
console.log('Saved placement-fix PDP/grid shots →', ARTIFACTS)
