#!/usr/bin/env node
import { chromium } from 'playwright'
import path from 'node:path'

const base = process.env.BASE_URL ?? 'http://localhost:3000'
const out = process.env.ARTIFACT_DIR ?? '/opt/cursor/artifacts'

const CLIP = { fracX: 0.12, fracY: 0.12, fracW: 0.76, fracH: 0.62 }

async function mockupClip(page) {
  const el = page.locator('[data-testid="merch-shirt-mockup"], figure img').first()
  const box = await el.boundingBox({ timeout: 10_000 }).catch(() => null)
  if (!box) return { x: 80, y: 60, width: 420, height: 520 }
  return {
    x: box.x + box.width * CLIP.fracX,
    y: box.y + box.height * CLIP.fracY,
    width: box.width * CLIP.fracW,
    height: box.height * CLIP.fracH,
  }
}

const browser = await chromium.launch()
const ctx = await browser.newContext({ deviceScaleFactor: 2, viewport: { width: 1280, height: 900 } })
const page = await ctx.newPage()

const designedSlug = '11-init-open-hand-give'
await page.goto(`${base}/en/merch/t-shirts/${designedSlug}`, { waitUntil: 'networkidle', timeout: 120_000 })
await page.waitForTimeout(500)
await page.screenshot({
  path: path.join(out, 'overlay-removal-designed-tee-after-3x.png'),
  clip: await mockupClip(page),
})

const shopSlug = 'unisex-heavy-blend-crewneck-sweatshirt-49'
await page.goto(`${base}/en/shop/${shopSlug}`, { waitUntil: 'networkidle', timeout: 120_000 })
await page.waitForTimeout(500)
const shopEl = page
  .locator('[data-testid="shop-product-preview"], [data-testid="merch-preview-figure"], figure')
  .first()
const shopBox = await shopEl.boundingBox({ timeout: 15_000 }).catch(() => null)
await page.screenshot({
  path: path.join(out, 'overlay-removal-plain-crewneck-with-wordmark-3x.png'),
  ...(shopBox ? { clip: shopBox } : { fullPage: false }),
})

await page.goto(`${base}/en/merch/all`, { waitUntil: 'networkidle', timeout: 120_000 })
await page.waitForTimeout(700)
await page.screenshot({
  path: path.join(out, 'overlay-removal-merch-all-grid-3x.png'),
  fullPage: false,
})

await ctx.close()
await browser.close()
console.log('saved artifacts to', out)
