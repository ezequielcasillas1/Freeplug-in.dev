#!/usr/bin/env node
import { chromium } from 'playwright'
import path from 'node:path'

const base = 'http://localhost:3000'
const out = '/opt/cursor/artifacts'

const shots = [
  { path: '/merch/t-shirts', name: 'supreme-tshirts-list-en', fullPage: true },
  { path: '/merch/t-shirts/23-world-know-a-plug', name: 'supreme-shirt-product-en', fullPage: true },
  { path: '/es/merch/t-shirts', name: 'supreme-tshirts-list-es', fullPage: true },
  { path: '/es/merch/t-shirts/23-world-know-a-plug', name: 'supreme-shirt-product-es', fullPage: true },
]

async function shot(page, file, fullPage) {
  await page.waitForTimeout(600)
  await page.screenshot({ path: file, fullPage })
  console.log('wrote', file)
}

const browser = await chromium.launch()
for (const width of [390, 1280]) {
  const page = await browser.newPage({ viewport: { width, height: width === 390 ? 844 : 1000 } })
  for (const s of shots) {
    await page.goto(`${base}${s.path}`, { waitUntil: 'networkidle' })
    await shot(page, path.join(out, `${s.name}-after-${width}px.png`), s.fullPage)
  }
  await page.close()
}
await browser.close()
