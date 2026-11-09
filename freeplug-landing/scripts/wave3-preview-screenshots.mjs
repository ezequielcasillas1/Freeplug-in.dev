#!/usr/bin/env node
import { chromium } from 'playwright'
import fs from 'node:fs'
import path from 'node:path'

const out = '/opt/cursor/artifacts/merch-wave3'
fs.mkdirSync(out, { recursive: true })
const base = 'http://localhost:3000'
const shots = [
  { path: '/merch/apparel/stay-charged-pullover', name: 'product-pullover-en-390px' },
  { path: '/merch/home-faith/kjv-woven-blanket', name: 'product-kjv-blanket-en-390px' },
  { path: '/es/merch/home-faith/kjv-woven-blanket', name: 'product-kjv-blanket-es-390px' },
  { path: '/merch/bags-accessories', name: 'collection-bags-en-390px' },
]

async function wait(page) {
  await page.waitForLoadState('networkidle', { timeout: 90_000 })
  await page.waitForSelector('main h1', { state: 'visible' })
  await page.evaluate(async () => {
    await document.fonts?.ready
    await new Promise((r) => setTimeout(r, 400))
  })
}

const browser = await chromium.launch()
for (const s of shots) {
  const page = await browser.newPage({ viewport: { width: 390, height: 900 } })
  await page.goto(`${base}${s.path}`, { waitUntil: 'domcontentloaded', timeout: 120_000 })
  await wait(page)
  const file = path.join(out, `${s.name}.png`)
  await page.screenshot({ path: file, fullPage: true })
  console.log('wrote', file)
  await page.close()
}
await browser.close()
