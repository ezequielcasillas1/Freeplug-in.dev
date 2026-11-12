#!/usr/bin/env node
import { chromium } from 'playwright'
import fs from 'node:fs'
import path from 'node:path'
import http from 'node:http'

const base = process.env.BASE_URL ?? 'http://127.0.0.1:3000'
const out = process.env.ARTIFACT_DIR ?? '/opt/cursor/artifacts'
fs.mkdirSync(out, { recursive: true })

const COMPARE_SLUGS = [
  '01-know-a-plug',
  '07-verse-psalm-82-3',
  '11-init-open-hand-give',
  '23-world-know-a-plug',
]

async function waitForShirtMockup(page) {
  await page.waitForFunction(() => {
    const fig = document.querySelector('[data-testid="merch-shirt-mockup"]')
    const img = fig?.querySelector('img')
    return Boolean(img?.complete && img.naturalWidth > 80)
  }, { timeout: 90_000 })
  await page.locator('[data-testid="merch-shirt-mockup"] svg').first().waitFor({ state: 'attached', timeout: 5_000 }).catch(() => undefined)
  await page.waitForTimeout(200)
}

async function mockupClip(page) {
  const el = page.locator('[data-testid="merch-shirt-mockup"]').first()
  const box = await el.boundingBox({ timeout: 15_000 })
  if (!box) throw new Error('mockup box missing')
  return box
}

async function gridCardClip(page, slug) {
  const link = page.locator(`a[href*="/merch/t-shirts/${slug}"]`).first()
  await link.scrollIntoViewIfNeeded()
  const box = await link.boundingBox({ timeout: 15_000 })
  if (!box) throw new Error(`grid card missing for ${slug}`)
  return { x: box.x, y: box.y, width: Math.min(box.width, 400), height: Math.min(box.height, 480) }
}

async function capturePair(page, slug) {
  await page.goto(`${base}/merch/t-shirts`, { waitUntil: 'domcontentloaded', timeout: 120_000 })
  await page.locator('[data-testid="tshirts-list"]').waitFor({ state: 'visible', timeout: 60_000 })
  await page.screenshot({
    path: path.join(out, `tshirt-grid-card-${slug}-en-1280.png`),
    clip: await gridCardClip(page, slug),
  })

  await page.goto(`${base}/merch/t-shirts/${slug}`, { waitUntil: 'domcontentloaded', timeout: 120_000 })
  await waitForShirtMockup(page)
  await page.screenshot({
    path: path.join(out, `tshirt-pdp-${slug}-en-1280.png`),
    clip: await mockupClip(page),
  })
  console.log('compare', slug)
}

async function fullGrid(page, localePath, name) {
  await page.setViewportSize({ width: 1280, height: 900 })
  await page.goto(`${base}${localePath}`, { waitUntil: 'domcontentloaded', timeout: 120_000 })
  await page.locator('[data-testid="tshirts-list"]').waitFor({ state: 'visible', timeout: 60_000 })
  await page.waitForTimeout(500)
  await page.screenshot({ path: path.join(out, name), fullPage: true })
}

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

for (const slug of COMPARE_SLUGS) {
  await capturePair(page, slug)
}

await fullGrid(page, '/merch/t-shirts', 'tshirts-grid-en-1280.png')
await fullGrid(page, '/es/merch/t-shirts', 'tshirts-grid-es-1280.png')

await browser.close()
console.log('artifacts in', out)
