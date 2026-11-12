#!/usr/bin/env node
/**
 * Live production PDP vs local grid parity for init/world tees (11–30).
 * Requires local `npm run start` and Playwright.
 */
import { chromium } from 'playwright'
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import sharp from 'sharp'
import { detectDuplicateSloganBands } from './lib/slogan-duplicate-detect.mjs'

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), '..')
const specs = JSON.parse(
  fs.readFileSync(path.join(root, 'src/lib/merch/shirts/supreme-preview-specs.json'), 'utf8')
)
const SLUGS = specs.map((s) => s.slug).sort()
const LIVE = process.env.LIVE_BASE ?? 'https://freeplug-in.dev'
const LOCAL = process.env.LOCAL_BASE ?? 'http://127.0.0.1:3000'
const out = process.env.ARTIFACT_DIR ?? '/opt/cursor/artifacts'
const MIN_MOCKUP_BYTES = 6_000
const bySlug = new Map(specs.map((s) => [s.slug, s]))

fs.mkdirSync(path.join(out, 'live-pdp-hero'), { recursive: true })
fs.mkdirSync(path.join(out, 'grid-vs-live'), { recursive: true })

const HERO_SLUGS = new Set([
  '11-init-open-hand-give',
  '13-init-daily-bread-share',
  '16-init-running-over',
  '18-init-charge-forward-care',
  '20-init-fp-shield-care',
  '22-world-fully-charged',
  '23-world-know-a-plug',
  '25-world-free-refills',
])

async function waitForMockupReady(locator) {
  await locator.waitFor({ state: 'visible', timeout: 90_000 })
  await locator.evaluate(async (fig) => {
    const img = fig.querySelector('img')
    if (!img) throw new Error('mockup img missing')
    if (typeof img.decode === 'function') await img.decode().catch(() => undefined)
    const deadline = Date.now() + 90_000
    while (Date.now() < deadline) {
      if (img.complete && img.naturalWidth > 80) return
      await new Promise((r) => setTimeout(r, 80))
    }
    throw new Error(`mockup not ready img=${img.naturalWidth}`)
  })
}

async function warmGridPage(page) {
  await page.goto(`${LOCAL}/merch/t-shirts`, { waitUntil: 'networkidle', timeout: 180_000 })
  await page.locator('[data-testid="tshirts-list"]').waitFor({ state: 'visible', timeout: 60_000 })
  const cards = page.locator('[data-testid="tshirts-list"] li a')
  const count = await cards.count()
  if (count < 35) throw new Error(`expected full grid, got ${count} cards`)
  for (let i = 0; i < count; i++) {
    await cards.nth(i).scrollIntoViewIfNeeded()
    const mockup = cards.nth(i).locator('[data-testid="merch-shirt-mockup"]')
    if ((await mockup.count()) === 0) continue
    await waitForMockupReady(mockup.first()).catch(() => undefined)
  }
  await page.evaluate(async () => {
    let y = 0
    const max = document.body.scrollHeight
    while (y <= max) {
      window.scrollTo(0, y)
      y += 450
      await new Promise((r) => setTimeout(r, 40))
    }
    window.scrollTo(0, 0)
    await new Promise((r) => setTimeout(r, 300))
  })
}

async function captureMockup(page, mockup, dest) {
  const box = await mockup.boundingBox()
  if (!box || box.width < 50 || box.height < 80) {
    throw new Error(`mockup too small for ${dest} ${JSON.stringify(box)}`)
  }
  await page.screenshot({ path: dest, clip: box })
  return dest
}

async function auditCardDom(page, slug) {
  return page.evaluate((s) => {
    const card = document.querySelector(`a[href*="/merch/t-shirts/${s}"]`)
    const fig = card?.querySelector('[data-testid="merch-shirt-mockup"]')
    if (!fig) return [`${s}: card missing`]
    const issues = []
    if (fig.querySelector('[data-testid="designed-tee-slogan-overlay"]')) {
      issues.push(`${s}: slogan SVG overlay present`)
    }
    const svgs = fig.querySelectorAll('svg')
    if (svgs.length) issues.push(`${s}: unexpected svg (${svgs.length})`)
    const src = fig.querySelector('img')?.getAttribute('src') ?? ''
    if (!/-front\.jpg/i.test(src) || /blank-front/.test(src)) {
      issues.push(`${s}: bad img src ${src}`)
    }
    return issues
  }, slug)
}

const browser = await chromium.launch()
const ctx = await browser.newContext({ viewport: { width: 1280, height: 900 } })
const page = await ctx.newPage()

const domIssues = []
const dupIssues = []
const gridPaths = new Map()

await warmGridPage(page)
for (const slug of SLUGS) {
  const gridPath = path.join(out, 'grid-vs-live', `${slug}-grid.png`)
  const card = page.locator(`a[href*="/merch/t-shirts/${slug}"]`).first()
  await card.scrollIntoViewIfNeeded()
  const gridMockup = card.locator('[data-testid="merch-shirt-mockup"]')
  await waitForMockupReady(gridMockup)
  await captureMockup(page, gridMockup, gridPath)
  gridPaths.set(slug, gridPath)

  const gridBytes = fs.statSync(gridPath).size
  if (gridBytes < MIN_MOCKUP_BYTES) domIssues.push(`${slug}: grid capture too small (${gridBytes} bytes)`)
  domIssues.push(...(await auditCardDom(page, slug)))

  const dup = await detectDuplicateSloganBands(gridPath, bySlug.get(slug).placement)
  if (dup.duplicate) dupIssues.push(`${slug}: ${dup.detail}`)
}

for (const slug of SLUGS) {
  const spec = bySlug.get(slug)
  const livePath = path.join(out, 'live-pdp-hero', `${slug}.png`)
  const gridPath = gridPaths.get(slug)
  const pairPath = path.join(out, 'grid-vs-live', `${slug}-live-vs-grid.png`)

  await page.goto(`${LIVE}/merch/t-shirts/${slug}`, { waitUntil: 'networkidle', timeout: 180_000 })
  const liveHero = page.locator('[data-testid="merch-shirt-mockup"]').first()
  await waitForMockupReady(liveHero)
  await page.waitForTimeout(200)
  await captureMockup(page, liveHero, livePath)

  const dupLive = await detectDuplicateSloganBands(livePath, spec.placement)
  if (dupLive.duplicate) dupIssues.push(`${slug}: live ${dupLive.detail}`)

  const [liveMeta, gridMeta] = await Promise.all([sharp(livePath).metadata(), sharp(gridPath).metadata()])
  const h = Math.min(liveMeta.height ?? 0, gridMeta.height ?? 0)
  const w = Math.max(liveMeta.width ?? 0, gridMeta.width ?? 0)
  const pad = 8
  const liveBuf = await sharp(livePath).resize({ width: w, height: h, fit: 'contain', background: '#fff' }).png().toBuffer()
  const gridBuf = await sharp(gridPath).resize({ width: w, height: h, fit: 'contain', background: '#fff' }).png().toBuffer()
  await sharp({
    create: { width: w * 2 + pad * 3, height: h + pad * 2, channels: 3, background: '#f4f4f4' },
  })
    .composite([
      { input: liveBuf, left: pad, top: pad },
      { input: gridBuf, left: pad * 2 + w, top: pad },
    ])
    .png()
    .toFile(pairPath)

  if (HERO_SLUGS.has(slug)) console.log('hero ok', slug)
}

await browser.close()

const report = { slugs: SLUGS.length, domIssues, dupIssues }
fs.writeFileSync(path.join(out, 'init-world-live-parity-report.json'), JSON.stringify(report, null, 2))
console.log(JSON.stringify(report, null, 2))

const fatal = [...domIssues, ...dupIssues]
if (fatal.length) {
  console.error('PARITY FAILED', fatal)
  process.exitCode = 1
}
