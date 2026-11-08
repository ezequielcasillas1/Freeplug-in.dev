#!/usr/bin/env node
import { chromium } from 'playwright'
import path from 'node:path'
import fs from 'node:fs'
import sharp from 'sharp'

const base = (process.env.SCREENSHOT_BASE_URL ?? 'http://localhost:3000').replace(/\/$/, '')
const out = '/opt/cursor/artifacts/merch-collections'
fs.mkdirSync(out, { recursive: true })

const collections = ['drinkware', 'hats', 'apparel', 'home-faith', 'desk-extras']

const shots = [
  ...collections.map((c) => ({ path: `/merch/${c}`, name: `collection-${c}-en` })),
  { path: '/merch/apparel/hero-crewneck', name: 'product-crewneck-en' },
  { path: '/merch/home-faith/running-over-canvas', name: 'product-canvas-en' },
  { path: '/merch/drinkware/fully-charged-mug', name: 'product-mug-en' },
  { path: '/es/merch/drinkware/fully-charged-mug', name: 'product-mug-es' },
  { path: '/es/merch/apparel/hero-crewneck', name: 'product-crewneck-es' },
]

const widths = [
  { w: 390, h: 900 },
  { w: 1280, h: 1000 },
]

async function waitForMerchPage(page) {
  await page.waitForLoadState('networkidle', { timeout: 90_000 })
  await page.waitForSelector('main h1', { state: 'visible', timeout: 30_000 })
  await page.evaluate(async () => {
    await document.fonts?.ready
    const deadline = Date.now() + 2500
    while (Date.now() < deadline) {
      const cards = [...document.querySelectorAll('main ul li, main h1')]
      const opaque = cards.every((el) => {
        const o = getComputedStyle(el).opacity
        return o === '' || Number(o) >= 0.99
      })
      if (opaque) break
      await new Promise((r) => setTimeout(r, 100))
    }
  })
  await page.waitForTimeout(200)
}

const browser = await chromium.launch()
const captured = []

for (const { w, h } of widths) {
  for (const s of shots) {
    if (s.name.endsWith('-es') && w === 1280) continue
    const page = await browser.newPage({ viewport: { width: w, height: h } })
    await page.goto(`${base}${s.path}`, { waitUntil: 'domcontentloaded', timeout: 120_000 })
    await waitForMerchPage(page)
    const file = path.join(out, `${s.name}-${w}px.png`)
    await page.screenshot({ path: file, fullPage: true })
    captured.push({ file, label: `${s.name} @${w}px` })
    console.log('wrote', file)
    await page.close()
  }
}
await browser.close()

const tileW = 320
const labelH = 32
const gap = 8
const pad = 12
const cols = 4
const rows = Math.ceil(captured.length / cols)

const thumbHeights = await Promise.all(
  captured.map(async (c) => {
    const meta = await sharp(c.file).metadata()
    const h = meta.height && meta.width ? Math.round((tileW / meta.width) * meta.height) : 480
    return Math.min(h, 720)
  })
)
const cellHeights = captured.map((_, i) => labelH + thumbHeights[i] + gap)
const rowHeights = Array.from({ length: rows }, (_, r) =>
  Math.max(...cellHeights.slice(r * cols, r * cols + cols))
)
const sheetW = pad * 2 + cols * tileW + (cols - 1) * gap
const sheetH = pad * 2 + rowHeights.reduce((a, b) => a + b + gap, -gap)

const composites = []
let y = pad
for (let r = 0; r < rows; r++) {
  let x = pad
  const rowH = rowHeights[r]
  for (let c = 0; c < cols; c++) {
    const i = r * cols + c
    if (i >= captured.length) break
    const { file, label } = captured[i]
    const safe = label.replace(/[<>&"']/g, (ch) => ({ '<': '&lt;', '>': '&gt;', '&': '&amp;', '"': '&quot;', "'": '&#39;' }[ch]))
    const labelSvg = Buffer.from(
      `<svg width="${tileW}" height="${labelH}"><rect width="100%" height="100%" fill="#f3f4f6"/><text x="6" y="21" font-family="system-ui,sans-serif" font-size="11" fill="#111827">${safe}</text></svg>`
    )
    const resized = await sharp(file).resize(tileW, thumbHeights[i], { fit: 'inside' }).png().toBuffer()
    composites.push({ input: labelSvg, left: x, top: y })
    composites.push({ input: resized, left: x, top: y + labelH })
    x += tileW + gap
  }
  y += rowH + gap
}

const contact = path.join(out, 'contact-sheet.png')
const grid = path.join(out, 'contact-sheet-grid.png')
await sharp({ create: { width: sheetW, height: sheetH, channels: 3, background: '#ffffff' } })
  .composite(composites)
  .png()
  .toFile(contact)
fs.copyFileSync(contact, grid)
console.log('wrote', contact)
console.log('wrote', grid)
