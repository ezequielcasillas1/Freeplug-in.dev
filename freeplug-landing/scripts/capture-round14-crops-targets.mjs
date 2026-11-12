#!/usr/bin/env node
import { existsSync, mkdirSync, readFileSync } from 'node:fs'
import path from 'node:path'
import sharp from 'sharp'
import { chromium } from 'playwright'

const ARTIFACTS = '/opt/cursor/artifacts'
const ROOT = process.cwd()
const COLS = 5
const CELL_W = 380
const CELL_H = 420
const LABEL_H = 36
const PREFIX = process.env.CROP_PREFIX ?? 'round14'
const SHEET_PREFIX = process.env.SHEET_PREFIX ?? 'round14-contact-pdp'
const base = process.env.BASE_URL ?? 'http://127.0.0.1:3013'

const ROUND14 = [
  'kiss-cut-stickers-400',
  'colored-frame-posters-5651',
  'natural-stone-stretch-bar-bracelet-engraving-2651',
  'circle-necklace-engraving-2341',
  'heart-necklace-engraving-2655',
  'horizontal-bar-necklace-engraving-2654',
  'cutout-heart-bar-necklace-engraving-2659',
  'cutout-paw-bar-necklace-engraving-2652',
  'wooden-ornaments-697',
  'clip-on-pet-bandana-1672',
  'dad-hat-with-leather-patch-rectangle-1221',
  'snapback-trucker-cap-1446',
  'picnic-blanket-1124',
  'posicharge-competitor-7-pocketed-short-4616',
  'unisex-joggers-embroidery-1903',
]

const manifestPath = path.join(ARTIFACTS, 'shop-overlay-contact-manifest.json')
const manifest = existsSync(manifestPath)
  ? JSON.parse(readFileSync(manifestPath, 'utf8'))
  : { pages: [] }
const slugToTile = new Map()
for (const { page, slugs } of manifest.pages ?? []) {
  slugs.forEach((slug, indexInPage) => slugToTile.set(slug, { page, indexInPage }))
}

async function captureDirect(slug) {
  const browser = await chromium.launch()
  const page = await browser.newPage({ viewport: { width: 1200, height: 1000 } })
  await page.goto(`${base}/shop/${slug}?wordmark_brand=freeplug-dev&wordmark_style=cursive`, {
    waitUntil: 'load',
    timeout: 90_000,
  })
  await page.waitForTimeout(500)
  const el = await page.$('[data-testid="shop-pdp-hero-mockup"]')
  if (!el) {
    await browser.close()
    throw new Error(`no hero ${slug}`)
  }
  const shot = await el.screenshot({ type: 'png' })
  await browser.close()
  const labeled = await sharp(shot)
    .resize(CELL_W, CELL_H - LABEL_H, { fit: 'contain', background: '#f4f4f5' })
    .extend({
      top: 0,
      bottom: LABEL_H,
      left: 0,
      right: 0,
      background: '#18181b',
    })
    .composite([{ input: Buffer.from(await textSvg(slug)), top: CELL_H - LABEL_H + 8, left: 8 }])
    .png()
    .toBuffer()
  return labeled
}

async function textSvg(slug) {
  const safe = slug.replace(/&/g, '&amp;').replace(/</g, '')
  const svg = `<svg width="360" height="24"><text x="0" y="16" fill="white" font-family="monospace" font-size="11">${safe}</text></svg>`
  return sharp(Buffer.from(svg)).png().toBuffer()
}

mkdirSync(ARTIFACTS, { recursive: true })
const notes = []

for (const slug of ROUND14) {
  const out = path.join(ARTIFACTS, `${PREFIX}-crop-${slug}.png`)
  const pos = slugToTile.get(slug)
  if (pos) {
    const sheet = path.join(ARTIFACTS, `${SHEET_PREFIX}-page${pos.page}.png`)
    if (existsSync(sheet)) {
      const row = Math.floor(pos.indexInPage / COLS)
      const col = pos.indexInPage % COLS
      await sharp(sheet)
        .extract({ left: col * CELL_W, top: row * CELL_H, width: CELL_W, height: CELL_H })
        .png()
        .toFile(out)
      console.log(`crop ${slug} from sheet page ${pos.page}`)
      continue
    }
  }
  try {
    const buf = await captureDirect(slug)
    await sharp(buf).png().toFile(out)
    console.log(`crop ${slug} direct PDP (hidden / not on sheet)`)
  } catch (err) {
    notes.push(`${slug}: ${err.message}`)
  }
}

if (notes.length) {
  console.warn('Crop notes:')
  for (const n of notes) console.warn(`  - ${n}`)
}
