#!/usr/bin/env node
import { chromium } from 'playwright'
import path from 'node:path'

const base = 'http://localhost:3000'
const out = '/opt/cursor/artifacts'
const shots = [
  { path: '/merch/t-shirts', name: 'supreme-tshirts-list-en' },
  { path: '/merch/t-shirts/23-world-know-a-plug', name: 'supreme-shirt-product-en' },
]

const browser = await chromium.launch()
for (const width of [390, 1280]) {
  const page = await browser.newPage({ viewport: { width, height: width === 390 ? 844 : 1000 } })
  for (const s of shots) {
    await page.goto(`${base}${s.path}`, { waitUntil: 'networkidle' })
    await page.waitForTimeout(500)
    const file = path.join(out, `${s.name}-before-${width}px.png`)
    await page.screenshot({ path: file, fullPage: true })
    console.log('wrote', file)
  }
  await page.close()
}
await browser.close()
