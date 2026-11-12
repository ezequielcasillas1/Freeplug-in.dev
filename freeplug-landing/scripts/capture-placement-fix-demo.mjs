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
  await page.goto(`${base}/shop/${slug}`, { waitUntil: 'domcontentloaded', timeout: 120_000 })
  await page.waitForLoadState('networkidle', { timeout: 60_000 }).catch(() => {})
  const el = await page.waitForSelector('[data-testid="shop-pdp-hero-mockup"]', {
    state: 'attached',
    timeout: 90_000,
  })
  await page
    .locator('[data-testid="shop-pdp-hero-mockup"] svg image, [data-testid="shop-pdp-hero-mockup"] img')
    .first()
    .waitFor({ state: 'attached', timeout: 60_000 })
    .catch(() => {})
  await page.waitForTimeout(600)
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

async function loadFullShopGrid(page) {
  await page.goto(`${base}/shop`, { waitUntil: 'load', timeout: 90_000 })
  for (;;) {
    const btn = page.getByRole('button', { name: /Show more|Mostrar más/i })
    if (!(await btn.count())) break
    await btn.click()
    await page.waitForTimeout(400)
  }
}

async function shotGridCard(slug, fileName) {
  await loadFullShopGrid(gridPage)
  const link = gridPage.locator(`a[href="/shop/${slug}"], a[href="/es/shop/${slug}"]`).first()
  const card = link.locator('xpath=ancestor::li[1]')
  await card.scrollIntoViewIfNeeded()
  await gridPage.waitForTimeout(300)
  await card.screenshot({ path: path.join(ARTIFACTS, fileName) })
}

for (const [slug, fileName] of [
  ['copper-vacuum-insulated-bottle-22oz-572', 'grid-card-copper-vacuum-bottle-572.png'],
  ['value-cabana-stripe-beach-towel-5583', 'grid-card-cabana-towel-5583.png'],
]) {
  await shotGridCard(slug, fileName)
}

for (const locale of ['', '/es']) {
  await gridPage.goto(`${base}${locale}/shop`, { waitUntil: 'load', timeout: 90_000 })
  await loadFullShopGrid(gridPage)
  await gridPage.screenshot({
    path: path.join(ARTIFACTS, `shop-grid-${locale ? 'es' : 'en'}-placement-fix-1280.png`),
    fullPage: false,
  })
}
await gridPage.close()

for (const [slug, fileName] of [
  ['copper-vacuum-insulated-bottle-22oz-572', 'pdp-copper-vacuum-bottle-572.png'],
  ['value-cabana-stripe-beach-towel-5583', 'pdp-cabana-towel-5583.png'],
]) {
  await shotPdp(slug, fileName)
}

await browser.close()
console.log('Saved placement-fix PDP/grid shots →', ARTIFACTS)
