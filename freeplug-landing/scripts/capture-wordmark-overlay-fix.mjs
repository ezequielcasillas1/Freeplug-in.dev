#!/usr/bin/env node
import { chromium } from 'playwright'
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), '..')
const base = process.env.BASE_URL ?? 'http://localhost:3000'
const out = process.env.ARTIFACT_DIR ?? '/opt/cursor/artifacts'

const specs = JSON.parse(fs.readFileSync(path.join(root, 'src/lib/merch/shirts/supreme-preview-specs.json'), 'utf8'))

const showcase = [
  '11-init-open-hand-give',
  '12-init-bridge-the-gap',
  '14-init-plug-in-kindness',
  '18-init-charge-forward-care',
  '23-world-know-a-plug',
  '26-world-senses-alive',
  '30-world-good-trouble-fun',
]

async function chestClip(page) {
  const el = page.locator('[data-testid="merch-shirt-mockup"], figure img, main img').first()
  const box = await el.boundingBox({ timeout: 8000 }).catch(() => null)
  if (!box) return { x: 40, y: 80, width: 220, height: 180 }
  return {
    x: box.x + box.width * 0.22,
    y: box.y + box.height * 0.28,
    width: box.width * 0.56,
    height: box.height * 0.38,
  }
}

const browser = await chromium.launch()
const ctx = await browser.newContext({ deviceScaleFactor: 3, viewport: { width: 1280, height: 900 } })
const page = await ctx.newPage()

for (const locale of ['en', 'es']) {
  const prefix = locale === 'es' ? '/es' : ''
  for (const slug of showcase) {
    await page.goto(`${base}${prefix}/merch/t-shirts/${slug}?preview=0`, { waitUntil: 'networkidle', timeout: 120_000 })
    await page.waitForTimeout(500)
    const clipBefore = await chestClip(page)
    await page.screenshot({ path: path.join(out, `overlay-before-${slug}-${locale}-3x.png`), clip: clipBefore })

    await page.goto(`${base}${prefix}/merch/t-shirts/${slug}`, { waitUntil: 'networkidle', timeout: 120_000 })
    await page.waitForTimeout(500)
    const clipAfter = await chestClip(page)
    await page.screenshot({ path: path.join(out, `overlay-after-${slug}-${locale}-3x.png`), clip: clipAfter })
    console.log('locale', locale, 'before/after', slug)
  }
}

for (const spec of specs) {
  try {
    await page.goto(`${base}/en/merch/t-shirts/${spec.slug}`, { waitUntil: 'networkidle', timeout: 120_000 })
    await page.waitForTimeout(250)
    const clip = await chestClip(page)
    await page.screenshot({ path: path.join(out, `overlay-verify-${spec.slug}-3x.png`), clip })
    console.log('verify', spec.slug)
  } catch (e) {
    console.warn('verify failed', spec.slug, e.message)
  }
}

await page.goto(`${base}/en/merch/t-shirts/wordmark-variations`, { waitUntil: 'networkidle', timeout: 120_000 })
await page.waitForTimeout(600)
await page.screenshot({ path: path.join(out, 'wordmark-variations-contact-1280-3x.png'), fullPage: true })
console.log('contact sheet')

await ctx.close()
await browser.close()
