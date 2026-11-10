#!/usr/bin/env node
import { chromium } from 'playwright'
import path from 'node:path'

const base = process.env.BASE_URL ?? 'http://localhost:3000'
const tag = process.env.SHOT_TAG ?? 'after'
const out = process.env.ARTIFACT_DIR ?? '/opt/cursor/artifacts'

const shots = [
  { path: '/merch/t-shirts', name: 'cheke-tshirts-list-en', fullPage: true },
  { path: '/merch/t-shirts/11-init-open-hand-give', name: 'cheke-tee-init-en', fullPage: true },
  { path: '/merch/t-shirts/25-world-free-refills', name: 'cheke-tee-world-en', fullPage: true },
  { path: '/merch/all', name: 'cheke-merch-all-en', fullPage: true },
  { path: '/shop/unisex-heavy-blend-crewneck-sweatshirt-49', name: 'cheke-shop-garment-en', fullPage: true },
  { path: '/merch/t-shirts/wordmark-variations', name: 'cheke-wordmark-contact-en', fullPage: true },
  { path: '/es/merch/t-shirts', name: 'cheke-tshirts-list-es', fullPage: true },
  { path: '/es/merch/t-shirts/11-init-open-hand-give', name: 'cheke-tee-init-es', fullPage: true },
  { path: '/es/merch/t-shirts/25-world-free-refills', name: 'cheke-tee-world-es', fullPage: true },
  { path: '/es/merch/all', name: 'cheke-merch-all-es', fullPage: true },
  { path: '/es/shop/unisex-heavy-blend-crewneck-sweatshirt-49', name: 'cheke-shop-garment-es', fullPage: true },
  { path: '/es/merch/t-shirts/wordmark-variations', name: 'cheke-wordmark-contact-es', fullPage: true },
]

async function shot(page, file, fullPage) {
  await page.waitForTimeout(800)
  await page.screenshot({ path: file, fullPage })
  console.log('wrote', file)
}

const browser = await chromium.launch()
for (const width of [390, 1280]) {
  const page = await browser.newPage({ viewport: { width, height: width === 390 ? 844 : 1000 } })
  for (const s of shots) {
    await page.goto(`${base}${s.path}`, { waitUntil: 'networkidle', timeout: 120_000 })
    await shot(page, path.join(out, `${s.name}-${tag}-${width}px.png`), s.fullPage)
  }
  await page.close()
}
await browser.close()
