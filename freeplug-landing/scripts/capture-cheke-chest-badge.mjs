#!/usr/bin/env node
import { chromium } from 'playwright'
import path from 'node:path'

const base = process.env.BASE_URL ?? 'http://localhost:3000'
const out = process.env.ARTIFACT_DIR ?? '/opt/cursor/artifacts'

const showcase = ['11-init-open-hand-give', '12-init-bridge-the-gap', '18-init-charge-forward-care', '23-world-know-a-plug', '26-world-senses-alive', '30-world-good-trouble-fun']

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
const ctx = await browser.newContext({ deviceScaleFactor: 3, viewport: { width: 1280, height: 900 } })
const page = await ctx.newPage()

for (const slug of showcase) {
  await page.goto(`${base}/en/merch/t-shirts/${slug}?preview=0`, { waitUntil: 'networkidle', timeout: 120_000 })
  await page.waitForTimeout(450)
  await page.screenshot({ path: path.join(out, `cheke-before-${slug}-en-3x.png`), clip: await mockupClip(page) })

  await page.goto(`${base}/en/merch/t-shirts/${slug}`, { waitUntil: 'networkidle', timeout: 120_000 })
  await page.waitForTimeout(450)
  await page.screenshot({ path: path.join(out, `cheke-after-${slug}-en-3x.png`), clip: await mockupClip(page) })
  console.log('en', slug)
}

await page.goto(`${base}/es/merch/t-shirts/30-world-good-trouble-fun?preview=0`, { waitUntil: 'networkidle', timeout: 120_000 })
await page.waitForTimeout(450)
await page.screenshot({ path: path.join(out, 'cheke-before-30-world-good-trouble-fun-es-3x.png'), clip: await mockupClip(page) })
await page.goto(`${base}/es/merch/t-shirts/30-world-good-trouble-fun`, { waitUntil: 'networkidle', timeout: 120_000 })
await page.waitForTimeout(450)
await page.screenshot({ path: path.join(out, 'cheke-after-30-world-good-trouble-fun-es-3x.png'), clip: await mockupClip(page) })

await page.goto(`${base}/en/merch/all`, { waitUntil: 'networkidle', timeout: 120_000 })
await page.waitForTimeout(600)
await page.screenshot({ path: path.join(out, 'cheke-all-merch-grid-1280-3x.png'), fullPage: false })
console.log('all-merch grid')

await ctx.close()
await browser.close()
