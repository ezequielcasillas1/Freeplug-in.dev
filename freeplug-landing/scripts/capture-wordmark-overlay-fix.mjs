#!/usr/bin/env node
import { chromium } from 'playwright'
import path from 'node:path'
import fs from 'node:fs'
import { fileURLToPath } from 'node:url'

const specs = JSON.parse(
  fs.readFileSync(
    path.join(path.dirname(fileURLToPath(import.meta.url)), '../src/lib/merch/shirts/supreme-preview-specs.json'),
    'utf8'
  )
)

const base = process.env.BASE_URL ?? 'http://localhost:3000'
const out = process.env.ARTIFACT_DIR ?? '/opt/cursor/artifacts'

async function chestClip(page) {
  const box = await page.locator('[data-testid="merch-shirt-mockup"], figure img, .aspect-square img').first().boundingBox()
  if (!box) return { x: 40, y: 80, width: 220, height: 160 }
  return {
    x: box.x + box.width * 0.08,
    y: box.y + box.height * 0.38,
    width: box.width * 0.55,
    height: box.height * 0.32,
  }
}

const browser = await chromium.launch()
const context = await browser.newContext({ deviceScaleFactor: 3, viewport: { width: 1280, height: 900 } })
const page = await context.newPage()

const showcase = ['11-init-open-hand-give', '18-init-charge-forward-care', '28-world-taste-the-charge']
for (const slug of showcase) {
  await page.goto(`${base}/en/merch/t-shirts/${slug}?preview=0`, { waitUntil: 'networkidle', timeout: 120_000 })
  await page.waitForTimeout(400)
  const clipBefore = await chestClip(page)
  await page.screenshot({ path: path.join(out, `overlay-before-${slug}-3x.png`), clip: clipBefore })
  await page.goto(`${base}/en/merch/t-shirts/${slug}`, { waitUntil: 'networkidle', timeout: 120_000 })
  await page.waitForTimeout(400)
  const clipAfter = await chestClip(page)
  await page.screenshot({ path: path.join(out, `overlay-after-${slug}-3x.png`), clip: clipAfter })
  console.log('before/after', slug)
}

for (const spec of specs) {
  await page.goto(`${base}/en/merch/t-shirts/${spec.slug}`, { waitUntil: 'networkidle', timeout: 120_000 })
  await page.waitForTimeout(300)
  const clip = await chestClip(page)
  await page.screenshot({ path: path.join(out, `overlay-verify-${spec.slug}-3x.png`), clip })
  console.log('verify', spec.slug)
}

await page.goto(`${base}/en/merch/all`, { waitUntil: 'networkidle', timeout: 120_000 })
await page.waitForTimeout(500)
await page.screenshot({
  path: path.join(out, 'overlay-all-merch-grid-1280-3x.png'),
  fullPage: false,
})
console.log('all-merch grid')

await context.close()
await browser.close()
