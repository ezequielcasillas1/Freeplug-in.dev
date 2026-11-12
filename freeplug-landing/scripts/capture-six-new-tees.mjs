#!/usr/bin/env node
import { chromium } from 'playwright'
import fs from 'node:fs'
import path from 'node:path'

const base = process.env.BASE_URL ?? 'http://127.0.0.1:3000'
const out = process.env.ARTIFACT_DIR ?? '/opt/cursor/artifacts'
const NEW_SLUGS = [
  '36-stand-144000-crest',
  '37-stand-144000-stencil',
  '38-stand-144000-blend',
  '39-knock-doors-left-chest',
  '40-knock-doors-centered',
  '41-knock-doors-front-back',
]

fs.mkdirSync(out, { recursive: true })

async function pickColor(page, color) {
  const btn = page.getByRole('button', { name: new RegExp(`^${color}$`, 'i') }).first()
  if ((await btn.count()) > 0) await btn.click()
}

async function main() {
  const browser = await chromium.launch()
  const page = await browser.newPage({ viewport: { width: 1280, height: 900 } })

  await page.goto(`${base}/merch/t-shirts`, { waitUntil: 'networkidle', timeout: 120_000 })
  await page.locator('[data-testid="tshirts-list"]').waitFor({ state: 'visible', timeout: 60_000 })
  const cards = page.locator('a[href*="/merch/t-shirts/"]')
  await cards.last().scrollIntoViewIfNeeded()
  await page.screenshot({ path: path.join(out, 'tshirts-grid-new-tees-bottom.png'), fullPage: true })

  for (const slug of NEW_SLUGS) {
    await page.goto(`${base}/merch/t-shirts/${slug}`, { waitUntil: 'networkidle', timeout: 120_000 })
    await page.locator('[data-testid="merch-shirt-mockup"]').first().waitFor({ state: 'visible', timeout: 60_000 })
    await pickColor(page, 'White')
    await page.waitForTimeout(400)
    await page.screenshot({ path: path.join(out, `pdp-${slug}-white.png`), fullPage: true })
    await pickColor(page, 'Black')
    await page.waitForTimeout(400)
    await page.screenshot({ path: path.join(out, `pdp-${slug}-black.png`), fullPage: true })
    if (slug === '41-knock-doors-front-back') {
      const backBtn = page.getByRole('button', { name: /back/i })
      if ((await backBtn.count()) > 0) {
        await backBtn.click()
        await page.waitForTimeout(400)
        await page.screenshot({ path: path.join(out, `pdp-${slug}-black-back.png`), fullPage: true })
      }
    }
  }

  await browser.close()
  console.log(`screenshots in ${out}`)
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})
