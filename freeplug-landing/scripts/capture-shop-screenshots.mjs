import { chromium, devices } from 'playwright'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const OUT = '/opt/cursor/artifacts'
const BASE = process.env.SHOP_SCREENSHOT_BASE ?? 'http://127.0.0.1:3000'

async function shot(page, name) {
  await page.screenshot({ path: path.join(OUT, name), fullPage: true })
  console.log('saved', name)
}

const browser = await chromium.launch()
const context = await browser.newContext({ viewport: { width: 1280, height: 900 } })
const page = await context.newPage()
await page.goto(`${BASE}/shop`, { waitUntil: 'networkidle' })
await shot(page, 'shop-landing-desktop.png')
await page.getByRole('button', { name: 'Apparel' }).click()
await page.waitForTimeout(400)
await shot(page, 'shop-category-apparel.png')
const slug = await page.locator('a[href*="/shop/"]').first().getAttribute('href')
const productPath = slug ?? '/shop/unisex-heavy-blend-crewneck-sweatshirt-49'
await page.goto(`${BASE}${productPath}`, { waitUntil: 'networkidle' })
await shot(page, 'shop-product-en.png')
await page.goto(`${BASE}/es${productPath}`, { waitUntil: 'networkidle' })
await shot(page, 'shop-product-es.png')
await page.goto(`${BASE}${productPath}`, { waitUntil: 'networkidle' })
await page.getByRole('button', { name: /Your artwork|Tu arte/i }).click()
await page.waitForSelector('input[type=file]', { timeout: 15000 })
const sample = path.join(__dirname, '../public/merch/shop/freeplug-logo-dark-garment.png')
await page.locator('input[type=file]').setInputFiles(sample)
await page.waitForTimeout(600)
await shot(page, 'shop-custom-upload.png')
const mobile = await browser.newContext({ ...devices['iPhone 12'], viewport: { width: 390, height: 844 } })
const mobilePage = await mobile.newPage()
await mobilePage.goto(`${BASE}/shop`, { waitUntil: 'networkidle' })
await mobilePage.screenshot({ path: path.join(OUT, 'shop-landing-mobile-390.png'), fullPage: true })
await browser.close()
