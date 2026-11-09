import { chromium } from 'playwright'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const OUT = '/opt/cursor/artifacts/shop-printify'
const BASE = process.env.SHOP_SCREENSHOT_BASE ?? 'http://127.0.0.1:3000'
const PRODUCT = '/en/shop/unisex-heavy-blend-crewneck-sweatshirt-49'

async function shot(page, name) {
  await page.screenshot({ path: path.join(OUT, name), fullPage: true })
  console.log('saved', name)
}

async function selectColor(page, label) {
  const colorSelect = page.locator('label:has-text("Color") select, label:has-text("Color") select').first()
  await colorSelect.waitFor({ state: 'visible', timeout: 15000 })
  await colorSelect.selectOption({ label })
  await page.waitForTimeout(800)
}

const browser = await chromium.launch()
const page = await browser.newPage({ viewport: { width: 1280, height: 900 } })

await page.goto(`${BASE}/en/shop`, { waitUntil: 'networkidle' })
await shot(page, 'shop-landing-grid-en.png')

await page.goto(`${BASE}${PRODUCT}`, { waitUntil: 'networkidle' })
await selectColor(page, 'Black')
await shot(page, 'shop-product-en-color-black.png')
await selectColor(page, 'Ash')
await shot(page, 'shop-product-en-color-ash.png')

await page.goto(`${BASE}/es/shop/unisex-heavy-blend-crewneck-sweatshirt-49`, { waitUntil: 'networkidle' })
await selectColor(page, 'Black')
await shot(page, 'shop-product-es-color-black.png')
await selectColor(page, 'Ash')
await shot(page, 'shop-product-es-color-ash.png')

await browser.close()
