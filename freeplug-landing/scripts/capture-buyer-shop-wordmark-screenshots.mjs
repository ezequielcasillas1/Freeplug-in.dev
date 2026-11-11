#!/usr/bin/env node
import { chromium } from 'playwright'
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const base = process.env.BASE_URL ?? 'http://127.0.0.1:3010'
const artifactDir = process.env.ARTIFACT_DIR ?? '/opt/cursor/artifacts'
const storeDir = process.env.STORE_ARTIFACT_DIR ?? '/cursor/stores/self/artifacts'

fs.mkdirSync(artifactDir, { recursive: true })
fs.mkdirSync(storeDir, { recursive: true })

const PDP = '/shop/unisex-heavy-blend-crewneck-sweatshirt-49'
const DARK_PDP = '/shop/district-v-i-t-men-s-fleece-hoodie-1979'

const pdpShots = [
  {
    name: 'pdp-freeplug-dev-cursive',
    qs: 'wordmark_brand=freeplug-dev&wordmark_style=cursive',
    expect: '/merch/buyer-wordmark-art/cursive/Freeplug.dev-on-light.png',
  },
  {
    name: 'pdp-fplgn-pop-v2',
    qs: 'wordmark_brand=fplgn&wordmark_style=pop-v2',
    expect: '/merch/buyer-wordmark-art/pop-v2/FPLGN-on-light.png',
  },
  {
    name: 'pdp-freeplug-in-dev-cursive-plate',
    qs: 'wordmark_brand=freeplug-in-dev&wordmark_style=cursive-plate',
    expect: '/merch/buyer-wordmark-art/cursive-plate/Freeplug-in.dev-on-light.png',
  },
  {
    name: 'pdp-freeplug-in-pop-plate-v2',
    qs: 'wordmark_brand=freeplug-in&wordmark_style=pop-plate-v2',
    expect: '/merch/buyer-wordmark-art/pop-plate-v2/Freeplug.in-on-light.png',
  },
]

async function waitOverlay(page) {
  await page
    .locator('svg image[href*="/merch/buyer-wordmark-art/"]')
    .first()
    .waitFor({ state: 'attached', timeout: 30_000 })
  await page.waitForTimeout(400)
}

async function assertOverlayHref(page, expected) {
  const href = await page.locator('svg image[href*="/merch/buyer-wordmark-art/"]').first().getAttribute('href')
  if (!href || !href.includes(expected)) {
    throw new Error(`Expected overlay href to include "${expected}", got "${href}"`)
  }
}

function writeBoth(fileName, buffer) {
  const a = path.join(artifactDir, fileName)
  const b = path.join(storeDir, fileName)
  fs.writeFileSync(a, buffer)
  fs.writeFileSync(b, buffer)
  console.log('wrote', a, 'and', b)
}

const browser = await chromium.launch()
const page = await browser.newPage({ viewport: { width: 1280, height: 900 } })

await page.goto(`${base}/shop`, { waitUntil: 'networkidle', timeout: 120_000 })
await page.waitForTimeout(600)
writeBoth('buyer-shop-grid-1280.png', await page.screenshot({ fullPage: true }))

for (const shot of pdpShots) {
  await page.goto(`${base}${PDP}?${shot.qs}`, { waitUntil: 'networkidle', timeout: 120_000 })
  await waitOverlay(page)
  await assertOverlayHref(page, shot.expect)
  writeBoth(`${shot.name}-1280.png`, await page.screenshot({ fullPage: false }))
}

await page.goto(
  `${base}${DARK_PDP}?color=Black&wordmark_brand=freeplug-dev&wordmark_style=cursive`,
  { waitUntil: 'networkidle', timeout: 120_000 }
)
await waitOverlay(page)
await assertOverlayHref(page, '/merch/buyer-wordmark-art/cursive/Freeplug.dev-on-dark.png')
writeBoth('pdp-dark-garment-black-cursive-1280.png', await page.screenshot({ fullPage: false }))

await browser.close()
