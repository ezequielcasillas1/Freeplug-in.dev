#!/usr/bin/env node
/**
 * Grid vs PDP mockup verification captures for PR #66.
 * Requires production server (npm run start) and Playwright chromium.
 */
import { chromium } from 'playwright'
import fs from 'node:fs'
import path from 'node:path'
import http from 'node:http'

const base = process.env.BASE_URL ?? 'http://127.0.0.1:3000'
const out = process.env.ARTIFACT_DIR ?? '/opt/cursor/artifacts'
const MIN_CARD_BYTES = 8_000
const MIN_PDP_BYTES = 12_000

fs.mkdirSync(out, { recursive: true })

const COMPARE_SLUGS = [
  '11-init-open-hand-give',
  '13-init-daily-bread-share',
  '16-init-running-over',
  '18-init-charge-forward-care',
  '23-world-know-a-plug',
  '25-world-free-refills',
]

const SUPREME_SLUGS = new Set(COMPARE_SLUGS)

async function assert200(urlPath) {
  return new Promise((resolve, reject) => {
    const req = http.get(`${base}${urlPath}`, (res) => {
      res.resume()
      if (res.statusCode !== 200) reject(new Error(`${urlPath} => ${res.statusCode}`))
      else resolve()
    })
    req.on('error', reject)
  })
}

async function waitForMockupReady(locator, { requireSvg = false } = {}) {
  await locator.waitFor({ state: 'visible', timeout: 90_000 })
  await locator.evaluate(
    async (fig, requireSvg) => {
      const img = fig.querySelector('img')
      if (!img) throw new Error('mockup img missing')
      if (typeof img.decode === 'function') await img.decode().catch(() => undefined)
      const deadline = Date.now() + 90_000
      while (Date.now() < deadline) {
        const okImg = img.complete && img.naturalWidth > 80
        const overlay = fig.querySelector('[data-testid="designed-tee-slogan-overlay"]')
        const okSvg = !requireSvg || Boolean(overlay)
        if (okImg && okSvg) return
        await new Promise((r) => setTimeout(r, 80))
      }
      throw new Error(`mockup not ready img=${img.naturalWidth} requireSvg=${requireSvg}`)
    },
    requireSvg
  )
}

async function waitForTshirtsGrid(page, { expectAllShirts = true }) {
  await page.goto(`${base}/merch/t-shirts`, { waitUntil: 'networkidle', timeout: 180_000 })
  await page.locator('[data-testid="tshirts-list"]').waitFor({ state: 'visible', timeout: 60_000 })

  if (expectAllShirts) {
    const rectToggle = page.getByRole('checkbox', { name: /rectangular|rectangul/i }).first()
    if ((await rectToggle.count()) > 0) {
      const checked = await rectToggle.isChecked()
      if (checked) {
        console.warn('rectangular filter was on; turning off for full-grid capture')
        await rectToggle.click()
        await page.waitForURL((url) => !url.searchParams.has('style'), { timeout: 15_000 }).catch(() => undefined)
      }
    }
  }

  const cards = page.locator('[data-testid="tshirts-list"] li a')
  await cards.first().waitFor({ state: 'visible', timeout: 60_000 })

  if (expectAllShirts) {
    const count = await cards.count()
    if (count < 35) {
      throw new Error(`expected full t-shirt grid, only ${count} cards (filters may be active)`)
    }
  }

  const total = await cards.count()
  for (let i = 0; i < total; i++) {
    await cards.nth(i).scrollIntoViewIfNeeded()
    const mockup = cards.nth(i).locator('[data-testid="merch-shirt-mockup"]')
    if ((await mockup.count()) === 0) continue
    await waitForMockupReady(mockup.first(), { requireSvg: false }).catch(() => undefined)
  }

  await page.evaluate(async () => {
    const step = 500
    let y = 0
    const max = document.body.scrollHeight
    while (y < max) {
      window.scrollTo(0, y)
      y += step
      await new Promise((r) => setTimeout(r, 40))
    }
    window.scrollTo(0, 0)
  })

  await page.waitForFunction(
    () => {
      const imgs = [...document.querySelectorAll('[data-testid="tshirts-list"] img')]
      return imgs.length > 0 && imgs.every((img) => img.complete && img.naturalWidth > 40)
    },
    { timeout: 90_000 }
  )
  await page.waitForTimeout(400)
}

async function auditGridMarks(page) {
  return page.evaluate(() => {
    const issues = []
    const cards = [...document.querySelectorAll('[data-testid="tshirts-list"] li a')]
    for (const card of cards) {
      const href = card.getAttribute('href') ?? ''
      const slug = href.split('/merch/t-shirts/')[1]?.split('?')[0] ?? ''
      const fig = card.querySelector('[data-testid="merch-shirt-mockup"]')
      if (!fig) continue
      const img = fig.querySelector('img')
      const src = img?.getAttribute('src') ?? ''
      if (!src.includes('-blank-front')) continue
      const slogan = fig.querySelector('[data-testid="designed-tee-slogan-overlay"]')
      const brandOverlay = fig.querySelectorAll(
        ':scope svg:not([data-testid="designed-tee-slogan-overlay"])'
      ).length
      if (!src.includes('-blank-front')) issues.push(`${slug}: expected blank-front base, got ${src}`)
      if (!slogan) issues.push(`${slug}: missing slogan overlay`)
      if (brandOverlay > 0) issues.push(`${slug}: extra brand overlay svg (${brandOverlay})`)
      if (slogan) {
        const inner = slogan.querySelector('g')
        const bbox = (inner ?? slogan).getBBox()
        if (bbox.x < -3 || bbox.y < -1 || bbox.x + bbox.width > 103 || bbox.y + bbox.height > 101) {
          issues.push(
            `${slug}: slogan bbox OOB ${bbox.x.toFixed(1)},${bbox.y.toFixed(1)} ${bbox.width.toFixed(1)}x${bbox.height.toFixed(1)}`
          )
        }
        const text = (slogan.textContent ?? '').replace(/\s+/g, ' ').trim()
        if (/\.dev\b|\.in\b/i.test(text)) issues.push(`${slug}: brand wordmark text "${text}"`)
        if (text.length < 4) issues.push(`${slug}: clipped text "${text}"`)
      }
    }
    const labels = [...document.querySelectorAll('label')]
    let rectangularOnly = false
    let previewOnPhotos = false
    for (const label of labels) {
      const text = label.textContent ?? ''
      const box = label.querySelector('input[type="checkbox"]')
      if (!box) continue
      if (/rectangular|rectangul/i.test(text)) rectangularOnly = box.checked
      if (/show on photos|mostrar en fotos|hide on photos|ocultar en fotos/i.test(text)) {
        previewOnPhotos = box.checked
      }
    }
    return { issues, cardCount: cards.length, rectangularOnly, previewOnPhotos }
  })
}

async function captureGridCard(page, slug) {
  await waitForTshirtsGrid(page, { expectAllShirts: true })
  const card = page.locator(`a[href*="/merch/t-shirts/${slug}"]`).first()
  await card.scrollIntoViewIfNeeded()
  const mockup = card.locator('[data-testid="merch-shirt-mockup"]')
  await waitForMockupReady(mockup, { requireSvg: SUPREME_SLUGS.has(slug) })
  const box = await mockup.boundingBox()
  if (!box || box.width < 50) throw new Error(`grid mockup box too small for ${slug}`)
  const file = path.join(out, `tshirt-grid-card-${slug}-en-1280.png`)
  await page.screenshot({ path: file, clip: box })
  const stat = fs.statSync(file)
  if (stat.size < MIN_CARD_BYTES) throw new Error(`${file} only ${stat.size} bytes (blank?)`)
  return file
}

async function capturePdp(page, slug) {
  await page.goto(`${base}/merch/t-shirts/${slug}`, { waitUntil: 'networkidle', timeout: 180_000 })
  const mockup = page.locator('[data-testid="merch-shirt-mockup"]').first()
  await waitForMockupReady(mockup, { requireSvg: SUPREME_SLUGS.has(slug) })
  const box = await mockup.boundingBox()
  if (!box) throw new Error(`PDP mockup missing for ${slug}`)
  const file = path.join(out, `tshirt-pdp-${slug}-en-1280.png`)
  await page.screenshot({ path: file, clip: box })
  const stat = fs.statSync(file)
  if (stat.size < MIN_PDP_BYTES) throw new Error(`${file} only ${stat.size} bytes (blank?)`)
  return file
}

async function fullGridShot(page, localePath, fileName, { styleRectangular = false } = {}) {
  const q = styleRectangular ? '?style=rectangular' : ''
  await page.setViewportSize({ width: 1280, height: 1200 })
  await page.goto(`${base}${localePath}${q}`, { waitUntil: 'networkidle', timeout: 180_000 })
  await page.locator('[data-testid="tshirts-list"]').waitFor({ state: 'visible', timeout: 60_000 })
  if (!styleRectangular) {
    const cards = page.locator('[data-testid="tshirts-list"] li a')
    const n = await cards.count()
    if (n < 35) console.warn(`${fileName}: only ${n} cards visible`)
    for (let i = 0; i < n; i++) {
      await cards.nth(i).scrollIntoViewIfNeeded()
      const mockup = cards.nth(i).locator('[data-testid="merch-shirt-mockup"]')
      if ((await mockup.count()) > 0) {
        await waitForMockupReady(mockup.first()).catch(() => undefined)
      }
    }
  }
  await page.evaluate(async () => {
    let y = 0
    const max = document.body.scrollHeight
    while (y <= max) {
      window.scrollTo(0, y)
      y += 450
      await new Promise((r) => setTimeout(r, 50))
    }
    window.scrollTo(0, 0)
    await new Promise((r) => setTimeout(r, 300))
  })
  await page.waitForLoadState('networkidle').catch(() => undefined)
  const file = path.join(out, fileName)
  await page.screenshot({ path: file, fullPage: true })
  const stat = fs.statSync(file)
  if (stat.size < 40_000 && !styleRectangular) {
    throw new Error(`${fileName} suspiciously small (${stat.size} bytes)`)
  }
  console.log('saved', fileName, stat.size, 'bytes')
}

const pdpPaths = [
  '/merch/t-shirts',
  '/es/merch/t-shirts',
  '/merch/t-shirts/01-know-a-plug',
  '/merch/t-shirts/07-verse-psalm-82-3',
  '/merch/t-shirts/11-init-open-hand-give',
  '/merch/t-shirts/23-world-know-a-plug',
  '/merch/t-shirts/35-world-straight-after-the-freeplug',
]

for (const p of pdpPaths) {
  await assert200(p)
  console.log('200', p)
}

const browser = await chromium.launch()
const ctx = await browser.newContext({ viewport: { width: 1280, height: 900 } })
const page = await ctx.newPage()

await waitForTshirtsGrid(page, { expectAllShirts: true })
const audit = await auditGridMarks(page)
console.log('audit', JSON.stringify(audit, null, 2))
const critical = audit.issues.filter(
  (i) =>
    i.includes('missing slogan') ||
    i.includes('brand wordmark') ||
    i.includes('extra brand') ||
    i.includes('clipped text')
)
if (critical.length) {
  console.error('critical grid audit issues:', critical)
  process.exitCode = 1
} else if (audit.issues.length) {
  console.warn('non-fatal audit notes:', audit.issues.slice(0, 5))
}
console.log(
  audit.rectangularOnly
    ? 'WARNING: rectangular style filter ON (unexpected for buyers)'
    : 'rectangular style filter OFF by default'
)
console.log('preview on photos default:', audit.previewOnPhotos)

for (const slug of COMPARE_SLUGS) {
  await captureGridCard(page, slug)
  await capturePdp(page, slug)
  console.log('pair ok', slug)
}

await fullGridShot(page, '/merch/t-shirts', 'tshirts-grid-en-1280.png')
await fullGridShot(page, '/es/merch/t-shirts', 'tshirts-grid-es-1280.png')
await fullGridShot(page, '/merch/t-shirts', 'tshirts-grid-en-rectangular-filter-1280.png', {
  styleRectangular: true,
})

await browser.close()
console.log('artifacts in', out)
