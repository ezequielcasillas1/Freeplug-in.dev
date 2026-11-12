#!/usr/bin/env node
/**
 * Scroll each shop grid card into view; report loaded garment images (all visible buyable rows).
 * Usage: BASE_URL=http://127.0.0.1:3012 node scripts/audit-shop-grid-image-load.mjs
 */
import { chromium } from 'playwright'

const base = process.env.BASE_URL ?? 'http://127.0.0.1:3012'

const browser = await chromium.launch()
const page = await browser.newPage({ viewport: { width: 1280, height: 900 } })
await page.goto(`${base}/shop`, { waitUntil: 'networkidle', timeout: 120_000 })

for (let round = 0; round < 12; round++) {
  const btn = page.getByRole('button', { name: 'Show more' })
  if ((await btn.count()) === 0) break
  const before = await page.locator('[aria-live="polite"]').first().textContent()
  await btn.first().scrollIntoViewIfNeeded()
  await btn.first().click()
  await page
    .waitForFunction(
      (prev) => {
        const t = document.querySelector('[aria-live="polite"]')?.textContent ?? ''
        return t !== prev
      },
      before,
      { timeout: 15_000 }
    )
    .catch(() => {})
  await page.waitForTimeout(200)
}

const lis = page.locator('ul.grid li')
const total = await lis.count()
let loaded = 0
let failed = []

for (let i = 0; i < total; i++) {
  const li = lis.nth(i)
  await li.scrollIntoViewIfNeeded()
  await page.waitForTimeout(80)
  const info = await li.evaluate((el) => {
    const img = el.querySelector('.aspect-square img')
    const title = el.querySelector('h2')?.textContent?.trim() ?? ''
    if (!img) return { title, ok: false, reason: 'no-img', w: 0, src: '' }
    return {
      title,
      ok: img.complete && img.naturalWidth > 10,
      w: img.naturalWidth,
      src: img.getAttribute('src') ?? '',
      complete: img.complete,
    }
  })
  if (info.ok) loaded++
  else failed.push({ i, ...info })
}

console.log(JSON.stringify({ total, loaded, missing: total - loaded, failed: failed.slice(0, 25) }, null, 2))
await browser.close()
process.exit(failed.length > 0 ? 1 : 0)
