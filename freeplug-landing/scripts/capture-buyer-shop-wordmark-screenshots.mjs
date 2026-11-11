#!/usr/bin/env node
import { chromium } from 'playwright'
import fs from 'node:fs'
import path from 'node:path'

const base = process.env.BASE_URL ?? 'http://127.0.0.1:3011'
const artifactDir = process.env.ARTIFACT_DIR ?? '/opt/cursor/artifacts'
const storeDir = process.env.STORE_ARTIFACT_DIR ?? '/cursor/stores/self/artifacts'

fs.mkdirSync(artifactDir, { recursive: true })
fs.mkdirSync(storeDir, { recursive: true })

const SWEAT = '/shop/unisex-heavy-blend-crewneck-sweatshirt-49'
const DARK_PDP = '/shop/district-v-i-t-men-s-fleece-hoodie-1979'

function writeBoth(fileName, buffer) {
  const a = path.join(artifactDir, fileName)
  const b = path.join(storeDir, fileName)
  fs.writeFileSync(a, buffer)
  fs.writeFileSync(b, buffer)
  console.log('wrote', a, 'and', b)
}

async function waitOverlay(page) {
  await page
    .locator('svg image[href*="/merch/buyer-wordmark-art/"]')
    .first()
    .waitFor({ state: 'attached', timeout: 30_000 })
  await page.waitForTimeout(500)
}

async function overlayHref(page) {
  return page.locator('svg image[href*="/merch/buyer-wordmark-art/"]').first().getAttribute('href')
}

const browser = await chromium.launch()
const page = await browser.newPage({ viewport: { width: 1280, height: 900 } })

await page.goto(`${base}/shop`, { waitUntil: 'networkidle', timeout: 120_000 })
await page.evaluate(async () => {
  const step = Math.max(400, Math.floor(window.innerHeight * 0.8))
  for (let y = 0; y < document.body.scrollHeight; y += step) {
    window.scrollTo(0, y)
    await new Promise((r) => setTimeout(r, 120))
  }
  window.scrollTo(0, 0)
})
await page.waitForTimeout(400)
writeBoth('buyer-shop-grid-1280.png', await page.screenshot({ fullPage: true }))

await page.goto(`${base}${DARK_PDP}?color=Black&wordmark_brand=freeplug-dev&wordmark_style=cursive`, {
  waitUntil: 'networkidle',
  timeout: 120_000,
})
await waitOverlay(page)
const darkHref = await overlayHref(page)
if (!darkHref?.includes('-on-dark.png')) throw new Error(`expected on-dark ink, got ${darkHref}`)
const mockupSrc = await page.locator('img.object-contain').first().getAttribute('src')
if (!mockupSrc?.includes('1979-0.webp')) throw new Error(`Black should show dark slide 1979-0, got ${mockupSrc}`)
writeBoth('pdp-dark-garment-black-cursive-1280.png', await page.screenshot({ fullPage: false }))

await page.goto(`${base}${SWEAT}`, { waitUntil: 'networkidle', timeout: 120_000 })
await waitOverlay(page)
const sequence = [
  { brand: 'freeplug-dev', style: 'cursive', fragment: 'cursive/Freeplug.dev-on-light' },
  { brand: 'fplgn', style: 'pop-v2', fragment: 'pop-v2/FPLGN-on-light' },
  { brand: 'freeplug-in-dev', style: 'cursive-plate', fragment: 'cursive-plate/Freeplug-in.dev-on-light' },
  { brand: 'freeplug-in', style: 'pop-plate-v2', fragment: 'pop-plate-v2/Freeplug.in-on-light' },
]
for (const step of sequence) {
  await page.getByTestId(`buyer-wordmark-brand-${step.brand}`).click()
  await page.getByTestId(`buyer-wordmark-style-${step.style}`).click()
  await page.waitForTimeout(400)
  const pressed = await page.getByTestId(`buyer-wordmark-brand-${step.brand}`).getAttribute('aria-pressed')
  if (pressed !== 'true') throw new Error(`chip click failed for brand ${step.brand}`)
  const href = await overlayHref(page)
  if (!href?.includes(step.fragment)) throw new Error(`after ${step.brand}/${step.style} expected ${step.fragment}, got ${href}`)
}
writeBoth('pdp-chip-sequence-final-1280.png', await page.screenshot({ fullPage: false }))

await browser.close()
