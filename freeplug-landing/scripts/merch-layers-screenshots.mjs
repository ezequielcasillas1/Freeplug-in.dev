#!/usr/bin/env node
import { chromium } from 'playwright'
import path from 'node:path'
import fs from 'node:fs'

const base = (process.env.SCREENSHOT_BASE_URL ?? 'http://localhost:3000').replace(/\/$/, '')
const out = '/opt/cursor/artifacts/merch-layers'
fs.mkdirSync(out, { recursive: true })

const shots = [
  { path: '/merch', name: 'merch-index-tiles-en' },
  { path: '/merch/give', name: 'merch-give-en' },
  { path: '/merch/mind', name: 'merch-mind-en' },
  { path: '/merch/all?layer=give', name: 'merch-all-layer-give-en' },
  { path: '/merch/home-faith/kjv-woven-blanket', name: 'product-other-layers-en' },
  { path: '/es/merch/give', name: 'merch-give-es' },
]

async function waitForMerchPage(page) {
  await page.waitForLoadState('networkidle', { timeout: 90_000 })
  await page.waitForSelector('main', { state: 'visible', timeout: 30_000 })
  await page.waitForTimeout(400)
}

const browser = await chromium.launch()
for (const s of shots) {
  const page = await browser.newPage({ viewport: { width: 1280, height: 1000 } })
  await page.goto(`${base}${s.path}`, { waitUntil: 'domcontentloaded', timeout: 120_000 })
  await waitForMerchPage(page)
  const file = path.join(out, `${s.name}.png`)
  await page.screenshot({ path: file, fullPage: true })
  console.log('wrote', file)
  await page.close()
}
await browser.close()
