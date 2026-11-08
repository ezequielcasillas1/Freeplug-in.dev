#!/usr/bin/env node
import { chromium } from 'playwright'
import path from 'node:path'
import { execFileSync } from 'node:child_process'
import fs from 'node:fs'

const base = process.env.SCREENSHOT_BASE_URL ?? 'http://localhost:3000'
const out = '/opt/cursor/artifacts/merch-collections'
fs.mkdirSync(out, { recursive: true })

const collections = ['drinkware', 'hats', 'apparel', 'home-faith', 'desk-extras']
const products = [
  { path: '/merch/apparel/hero-crewneck', name: 'product-crewneck-en' },
  { path: '/merch/home-faith/running-over-canvas', name: 'product-canvas-en' },
  { path: '/merch/drinkware/fully-charged-mug', name: 'product-mug-en' },
  { path: '/es/merch/drinkware/fully-charged-mug', name: 'product-mug-es' },
]
const widths = [
  { w: 390, h: 900 },
  { w: 1280, h: 1000 },
]

const paths = [
  ...collections.map((c) => ({ path: `/merch/${c}`, name: `collection-${c}-en` })),
  ...products,
]

const browser = await chromium.launch()
const files = []

for (const { w, h } of widths) {
  const page = await browser.newPage({ viewport: { width: w, height: h } })
  for (const s of paths) {
    await page.goto(`${base}${s.path}`, { waitUntil: 'networkidle', timeout: 120_000 })
    await page.waitForTimeout(600)
    const file = path.join(out, `${s.name}-${w}px.png`)
    await page.screenshot({ path: file, fullPage: true })
    files.push(file)
    console.log('wrote', file)
  }
  await page.close()
}
await browser.close()

const contact = path.join(out, 'contact-sheet.png')
const montage = files.map((f) => `"${f}"`).join(' ')
try {
  execFileSync('bash', ['-lc', `montage ${montage} -tile 4x -geometry 320x+4+4 -background white "${contact}"`], {
    stdio: 'inherit',
  })
  console.log('wrote', contact)
} catch {
  const grid = path.join(out, 'contact-sheet-grid.png')
  execFileSync(
    'ffmpeg',
    [
      '-y',
      '-pattern_type',
      'glob',
      '-i',
      `${out}/*-390px.png`,
      '-filter_complex',
      'tile=4x2',
      '-frames:v',
      '1',
      '-update',
      '1',
      grid,
    ],
    { stdio: 'inherit' }
  )
  console.log('wrote fallback', grid)
}
