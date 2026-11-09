#!/usr/bin/env node
/**
 * Capture PR screenshots from a running next start (production) server.
 * Usage: node scripts/capture-giving-verses-screenshots.mjs [--base http://127.0.0.1:3457]
 */
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { chromium, devices } from 'playwright'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const OUT = process.env.SCREENSHOT_OUT ?? '/opt/cursor/artifacts'
const base = process.argv.find((a) => a.startsWith('http')) ?? 'http://127.0.0.1:3457'
const PDP = `${base}/merch/apparel/giving-verses-tee`
const PDP_ES = `${base}/es/merch/apparel/giving-verses-tee`
const LEGACY = `${base}/merch/apparel/good-measure-longsleeve`
const GRID = `${base}/merch/apparel`

async function waitPdpReady(page) {
  await page.goto(PDP, { waitUntil: 'networkidle' })
  await page.waitForSelector('h1', { state: 'visible', timeout: 20000 })
  await page.waitForSelector('main img[src*="giving-verses/"]', { state: 'visible', timeout: 20000 })
  await page.waitForFunction(
    () => {
      const h1 = document.querySelector('h1')
      if (!h1) return false
      return parseFloat(getComputedStyle(h1).opacity) > 0.5
    },
    { timeout: 20000 }
  )
  await page.getByRole('button', { name: /Proverbs 19:17/ }).waitFor({ state: 'visible', timeout: 10000 })
}

async function main() {
  const browser = await chromium.launch()
  const desktop = await browser.newContext({ viewport: { width: 1280, height: 900 } })
  const page = await desktop.newPage()

  await waitPdpReady(page)
  await page.screenshot({ path: path.join(OUT, 'giving-verses-en-desktop.png'), fullPage: true })

  await page.goto(PDP_ES, { waitUntil: 'networkidle' })
  await page.waitForSelector('h1', { state: 'visible', timeout: 20000 })
  await page.waitForSelector('main img[src*="giving-verses/"]', { state: 'visible', timeout: 20000 })
  await page.screenshot({ path: path.join(OUT, 'giving-verses-es-desktop.png'), fullPage: true })

  await waitPdpReady(page)
  const imgBefore = await page.locator('main img').first().getAttribute('src')
  await page.getByRole('button', { name: 'Acts 20:35' }).click()
  await page.waitForFunction(
    (prev) => {
      const img = document.querySelector('main img')
      return img && img.getAttribute('src') !== prev && img.getAttribute('src')?.includes('07-acts')
    },
    imgBefore,
    { timeout: 10000 }
  )
  await page.screenshot({ path: path.join(OUT, 'giving-verses-verse-07-acts-desktop.png'), fullPage: true })

  await waitPdpReady(page)
  const whiteBtn = page.getByRole('button', { name: 'White', exact: true })
  if (await whiteBtn.isVisible()) {
    await whiteBtn.click()
    await page.waitForSelector('main img[src*="on-light"]', { timeout: 10000 })
    await page.screenshot({ path: path.join(OUT, 'giving-verses-color-white-desktop.png'), fullPage: true })
  }
  const blackBtn = page.getByRole('button', { name: 'Black', exact: true })
  if (await blackBtn.isVisible()) {
    await blackBtn.click()
    await page.waitForSelector('main img[src*="on-dark"]', { timeout: 10000 })
  }

  const iphone = await browser.newContext({ ...devices['iPhone 13'] })
  const mobile = await iphone.newPage()
  await mobile.goto(PDP, { waitUntil: 'networkidle' })
  await mobile.waitForSelector('main img[src*="giving-verses"]', { state: 'visible', timeout: 20000 })
  await mobile.screenshot({ path: path.join(OUT, 'giving-verses-en-mobile.png'), fullPage: true })

  await page.goto(GRID, { waitUntil: 'networkidle' })
  await page.waitForSelector('a[href*="giving-verses-tee"]', { timeout: 15000 })
  await page.screenshot({ path: path.join(OUT, 'merch-apparel-grid-en-desktop.png'), fullPage: true })

  const redirectPage = await desktop.newPage()
  await redirectPage.goto(LEGACY, { waitUntil: 'networkidle' })
  await redirectPage.waitForURL('**/giving-verses-tee**', { timeout: 15000 })
  await redirectPage.waitForSelector('main img[src*="giving-verses"]', { state: 'visible', timeout: 20000 })
  await redirectPage.screenshot({ path: path.join(OUT, 'giving-verses-301-from-good-measure.png'), fullPage: true })

  await browser.close()
  console.log(`Screenshots written to ${OUT}`)
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})
