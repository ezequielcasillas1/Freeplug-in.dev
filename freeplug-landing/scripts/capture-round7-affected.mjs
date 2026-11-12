#!/usr/bin/env node
/** PDP/grid shots for round-7 blocker items + favorites. */
import { mkdirSync } from 'node:fs'
import path from 'node:path'
import { chromium } from 'playwright'

const base = process.env.BASE_URL ?? 'http://127.0.0.1:3018'
const ARTIFACTS = '/opt/cursor/artifacts'
mkdirSync(ARTIFACTS, { recursive: true })

const CLOSEUP = [
  'unisex-softstyle-t-shirt-145',
  'unisex-heather-cvc-short-sleeve-tee-3013',
  'easy-cotton-tee-3127',
  'district-perfect-tri-tee-2027',
  'women-s-favorite-tee-9',
  'tie-dye-tee-crystal-630',
  'tie-dye-tee-cyclone-631',
  'the-concert-tee-2835',
  'canvas-tote-bag-5-color-straps-507',
  'cotton-tote-bag-553',
  'cotton-canvas-tote-bag-1313',
  'pint-glass-16oz-633',
  'unisex-fleece-zip-up-hoodie-1925',
  'unisex-tri-blend-long-sleeve-colorblock-raglan-3004',
  'insulated-lunch-tote-5123',
  'day-tote-5096',
]

const PDP = [
  'unisex-jersey-short-sleeve-tee-12',
  'paper-gift-bag-2729',
  'scented-soy-candles-with-black-lid-4-and-9oz-1943',
  'scented-candles-coconut-apricot-wax-4oz-9oz-1488',
  'dad-hat-with-leather-patch-round-1287',
  'copper-vacuum-insulated-bottle-22oz-572',
  'vacuum-insulated-tumbler-11oz-604',
  'canvas-mesh-back-cap-4802',
  'hardboard-coasters-with-cork-bottom-set-of-4-2764',
  'scented-soy-candle-multi-size-amber-jar-1468',
  'women-s-favorite-tee-9',
  'tie-dye-tee-cyclone-631',
  'tie-dye-tee-crystal-630',
  'cotton-tote-bag-553',
  'insulated-lunch-tote-5123',
  'day-tote-5096',
  'scented-soy-candles-with-white-lid-9oz-755',
]

const browser = await chromium.launch()
for (const slug of PDP) {
  const page = await browser.newPage({ viewport: { width: 1200, height: 1000 } })
  await page.goto(`${base}/shop/${slug}`, { waitUntil: 'networkidle', timeout: 120_000 })
  const hero = await page.waitForSelector('[data-testid="shop-pdp-hero-mockup"]', { timeout: 90_000 })
  await page.waitForTimeout(700)
  await hero.screenshot({ path: path.join(ARTIFACTS, `round7-pdp-${slug}.png`) })
  if (CLOSEUP.includes(slug)) {
    const box = await hero.boundingBox()
    if (box) {
      const crop = {
        x: box.x + box.width * 0.2,
        y: box.y + box.height * 0.22,
        width: box.width * 0.6,
        height: box.height * 0.42,
      }
      await page.screenshot({ path: path.join(ARTIFACTS, `round7-crop-${slug}.png`), clip: crop })
    }
  }
  await page.close()
}

const page = await browser.newPage({ viewport: { width: 1280, height: 900 } })
await page.goto(`${base}/shop`, { waitUntil: 'networkidle', timeout: 120_000 })
for (let i = 0; i < 30; i++) {
  const btn = page.getByRole('button', { name: /Show more|Mostrar más/i })
  if (!(await btn.count())) break
  await btn.click()
  await page.waitForTimeout(350)
}
await page.locator('a[href="/shop/copper-vacuum-insulated-bottle-22oz-572"]').first().locator('xpath=ancestor::li[1]').screenshot({
  path: path.join(ARTIFACTS, 'grid-card-copper-vacuum-bottle-572.png'),
})
await browser.close()
console.log('Round-7 captures →', ARTIFACTS)
