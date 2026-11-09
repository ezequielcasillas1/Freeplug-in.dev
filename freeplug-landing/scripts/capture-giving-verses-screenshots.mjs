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

async function waitPdpReady(page, expectDark = true) {
  await page.goto(PDP, { waitUntil: 'networkidle' })
  await page.waitForSelector('h1', { state: 'visible', timeout: 20000 })
  const imgSel = expectDark ? 'main img[src*="on-dark"]' : 'main img[src*="on-light"]'
  await page.waitForSelector(imgSel, { state: 'visible', timeout: 20000 })
  await page.getByRole('button', { name: 'Asphalt', exact: true }).waitFor({ state: 'visible', timeout: 10000 })
}

async function clickColor(page, name) {
  const btn = page.getByRole('button', { name, exact: true })
  await btn.click()
  const kind = ['White', 'Athletic Heather'].includes(name) ? 'on-light' : 'on-dark'
  await page.waitForSelector(`main img[src*="${kind}"]`, { timeout: 10000 })
}

async function main() {
  const browser = await chromium.launch()
  const desktop = await browser.newContext({ viewport: { width: 1280, height: 900 } })
  const page = await desktop.newPage()

  await waitPdpReady(page, true)
  await page.screenshot({ path: path.join(OUT, 'giving-verses-en-desktop.png'), fullPage: true })

  await page.goto(PDP_ES, { waitUntil: 'networkidle' })
  await page.waitForSelector('main img[src*="on-dark"]', { state: 'visible', timeout: 20000 })
  await page.screenshot({ path: path.join(OUT, 'giving-verses-es-desktop.png'), fullPage: true })

  const iphone = await browser.newContext({ ...devices['iPhone 13'] })
  const mobile = await iphone.newPage()
  await mobile.goto(PDP, { waitUntil: 'networkidle' })
  await mobile.waitForSelector('main img[src*="on-dark"]', { state: 'visible', timeout: 20000 })
  await mobile.screenshot({ path: path.join(OUT, 'giving-verses-en-mobile.png'), fullPage: true })

  await waitPdpReady(page, true)
  await clickColor(page, 'White')
  await page.screenshot({ path: path.join(OUT, 'giving-verses-color-white-desktop.png'), fullPage: true })

  await clickColor(page, 'Black')
  await page.screenshot({ path: path.join(OUT, 'giving-verses-color-black-desktop.png'), fullPage: true })

  await page.goto(GRID, { waitUntil: 'networkidle' })
  await page.waitForSelector('a[href*="giving-verses-tee"]', { timeout: 15000 })
  await page.screenshot({ path: path.join(OUT, 'merch-apparel-grid-en-desktop.png'), fullPage: true })

  const redirectPage = await desktop.newPage()
  await redirectPage.goto(LEGACY, { waitUntil: 'networkidle' })
  await redirectPage.waitForURL('**/giving-verses-tee**', { timeout: 15000 })
  await redirectPage.waitForSelector('main img[src*="on-dark"]', { state: 'visible', timeout: 20000 })
  await redirectPage.screenshot({ path: path.join(OUT, 'giving-verses-301-from-good-measure.png'), fullPage: true })

  await browser.close()
  console.log(`Screenshots written to ${OUT}`)
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})
