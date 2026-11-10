#!/usr/bin/env node
/** One screenshot per supreme slug PDP for placement review. */
import { chromium } from 'playwright'
import path from 'node:path'
import { readFileSync } from 'node:fs'

const base = process.env.BASE_URL ?? 'http://localhost:3000'
const out = process.env.ARTIFACT_DIR ?? '/opt/cursor/artifacts/placement-review'

const specs = JSON.parse(
  readFileSync(
    new URL('../src/lib/merch/shirts/supreme-preview-specs.json', import.meta.url),
    'utf8'
  )
)

const browser = await chromium.launch()
const page = await browser.newPage({ viewport: { width: 480, height: 640 } })
for (const s of specs) {
  await page.goto(`${base}/merch/t-shirts/${s.slug}`, { waitUntil: 'networkidle', timeout: 120_000 })
  await page.waitForTimeout(500)
  const file = path.join(out, `${s.slug}-top${s.placement.top}.png`)
  const fig = page.locator('figure').first()
  await fig.screenshot({ path: file })
  console.log('wrote', file)
}
await browser.close()
