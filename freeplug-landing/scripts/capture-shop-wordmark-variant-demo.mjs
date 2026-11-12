#!/usr/bin/env node
/** PDP variant before/after + EN/ES grid. BASE_URL=http://127.0.0.1:3013 */
import { mkdirSync } from 'node:fs'
import path from 'node:path'
import { chromium } from 'playwright'

const base = process.env.BASE_URL ?? 'http://127.0.0.1:3013'
const ARTIFACTS = '/opt/cursor/artifacts'
const PDP = 'cotton-canvas-tote-bag-1313'

const VARIANTS = [
  ['cursive', 'freeplug-dev'],
  ['pop-v2', 'fplgn'],
  ['cursive-plate', 'freeplug-in-dev'],
  ['pop-plate-v2', 'freeplug-in'],
]

mkdirSync(ARTIFACTS, { recursive: true })
const browser = await chromium.launch()
const page = await browser.newPage({ viewport: { width: 1200, height: 1000 } })

await page.goto(`${base}/shop/${PDP}`, { waitUntil: 'networkidle' })
await page.getByTestId('shop-pdp-hero-mockup').screenshot({
  path: path.join(ARTIFACTS, 'pdp-wordmark-before-default.png'),
})

for (const [style, brand] of VARIANTS) {
  await page.getByTestId(`buyer-wordmark-brand-${brand}`).click()
  await page.getByTestId(`buyer-wordmark-style-${style}`).click()
  await page.waitForTimeout(400)
  await page.getByTestId('shop-pdp-hero-mockup').screenshot({
    path: path.join(ARTIFACTS, `pdp-wordmark-${style}-${brand}.png`),
  })
}

for (const locale of ['', '/es']) {
  await page.goto(`${base}${locale}/shop`, { waitUntil: 'networkidle' })
  for (;;) {
    const btn = page.getByRole('button', { name: /Show more|Mostrar más/i })
    if (!(await btn.count())) break
    await btn.click()
    await page.waitForTimeout(300)
  }
  await page.screenshot({
    path: path.join(ARTIFACTS, `shop-grid-${locale ? 'es' : 'en'}-1280.png`),
    fullPage: false,
  })
}

await browser.close()
console.log('Saved variant demo shots →', ARTIFACTS)
