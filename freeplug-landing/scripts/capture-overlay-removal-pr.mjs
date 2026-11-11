#!/usr/bin/env node
import { chromium } from 'playwright'
import path from 'node:path'

const base = process.env.BASE_URL ?? 'http://localhost:3000'
const out = process.env.ARTIFACT_DIR ?? '/opt/cursor/artifacts'

const CLIP = { fracX: 0.12, fracY: 0.12, fracW: 0.76, fracH: 0.62 }

async function waitForShirtMockupImage(page) {
  await page.waitForFunction(() => {
    const fig = document.querySelector('[data-testid="merch-shirt-mockup"]')
    if (!fig) return false
    const host = fig.closest('.order-1') ?? fig.parentElement
  if (!host) return false
    const hostOp = parseFloat(getComputedStyle(host).opacity)
    const img = fig.querySelector('img')
    return hostOp >= 0.99 && Boolean(img && img.complete && img.naturalWidth > 80)
  }, { timeout: 60_000 })
  const locator = page.locator('[data-testid="merch-shirt-mockup"] img')
  await locator.evaluate((img) => {
    if (typeof img.decode === 'function') return img.decode().catch(() => undefined)
  })
  await page.waitForTimeout(150)
}

async function mockupClip(page) {
  const el = page.locator('[data-testid="merch-shirt-mockup"] img').first()
  await waitForShirtMockupImage(page)
  const box = await el.boundingBox({ timeout: 10_000 })
  if (!box || box.width < 20 || box.height < 20) {
    const fig = await page.locator('[data-testid="merch-shirt-mockup"]').boundingBox()
    return fig ?? { x: 80, y: 60, width: 420, height: 520 }
  }
  return {
    x: box.x + box.width * CLIP.fracX,
    y: box.y + box.height * CLIP.fracY,
    width: box.width * CLIP.fracW,
    height: box.height * CLIP.fracH,
  }
}

async function captureDesignedTee(page, slug, filename) {
  await page.goto(`${base}/en/merch/t-shirts/${slug}`, { waitUntil: 'domcontentloaded', timeout: 120_000 })
  await waitForShirtMockupImage(page)
  const hasOverlay = await page.locator('[data-testid="merch-shirt-mockup"] svg').count()
  if (hasOverlay > 0) console.warn(slug, 'unexpected overlay svg count', hasOverlay)
  await page.screenshot({ path: path.join(out, filename), clip: await mockupClip(page) })
  console.log('saved', filename)
}

const browser = await chromium.launch()
const ctx = await browser.newContext({ deviceScaleFactor: 2, viewport: { width: 1280, height: 900 } })
const page = await ctx.newPage()

await captureDesignedTee(page, '11-init-open-hand-give', 'overlay-removal-designed-tee-11-after-3x.png')
await captureDesignedTee(page, '11-init-open-hand-give', 'overlay-removal-designed-tee-after-3x.png')
await captureDesignedTee(page, '35-world-straight-after-the-freeplug', 'overlay-removal-designed-tee-35-after-3x.png')
await captureDesignedTee(page, '07-verse-psalm-82-3', 'overlay-removal-designed-tee-verse-07-after-3x.png')

await page.goto(`${base}/en/merch/t-shirts`, { waitUntil: 'domcontentloaded', timeout: 120_000 })
const gridImgs = page.locator('[data-testid="tshirts-list"] img')
await gridImgs.first().waitFor({ state: 'visible', timeout: 60_000 })
const count = Math.min(await gridImgs.count(), 12)
for (let i = 0; i < count; i++) {
  await gridImgs.nth(i).scrollIntoViewIfNeeded()
  await gridImgs.nth(i).evaluate((img) => {
    if (typeof img.decode === 'function') return img.decode().catch(() => undefined)
  })
}
await page.waitForFunction(
  (n) => {
    const imgs = [...document.querySelectorAll('[data-testid="tshirts-list"] img')].slice(0, n)
    return imgs.length >= n && imgs.every((img) => img.complete && img.naturalWidth > 40)
  },
  count,
  { timeout: 60_000 }
)
await page.waitForTimeout(300)
await page.screenshot({
  path: path.join(out, 'overlay-removal-merch-tshirts-grid-3x.png'),
  fullPage: false,
})
console.log('saved t-shirts grid')

await ctx.close()
await browser.close()
console.log('artifacts in', out)
