#!/usr/bin/env node
import { chromium } from 'playwright'
import path from 'node:path'

const base = 'http://localhost:3000'
const out = '/opt/cursor/artifacts'
const shots = [
  { path: '/merch/t-shirts', name: 'tshirts-list-en' },
  { path: '/merch/t-shirts/01-know-a-plug', name: 'shirt-product-en' },
  { path: '/es/merch/t-shirts', name: 'tshirts-list-es' },
  { path: '/es/merch/t-shirts/01-know-a-plug', name: 'shirt-product-es' },
]
const widths = [320, 375, 1280]

const browser = await chromium.launch()
for (const w of widths) {
  const page = await browser.newPage({ viewport: { width: w, height: w === 375 ? 900 : 1000 } })
  for (const s of shots) {
    await page.goto(`${base}${s.path}`, { waitUntil: 'networkidle' })
    await page.waitForTimeout(500)
    const file = path.join(out, `${s.name}-${w}px.png`)
    await page.screenshot({ path: file, fullPage: true })
    console.log('wrote', file)
  }
  await page.close()
}
await browser.close()
