#!/usr/bin/env node
/**
 * Labeled PDP contact-sheet crops — positions from shop-overlay-contact-manifest.json
 * (filtered slug order), not raw catalog index.
 *
 * Usage: CROP_PREFIX=round12 node scripts/capture-round10-crops.mjs
 */
import { existsSync, mkdirSync, readFileSync } from 'node:fs'
import path from 'node:path'
import sharp from 'sharp'

const ARTIFACTS = '/opt/cursor/artifacts'
const ROOT = path.join(process.cwd())
const COLS = 5
const CELL_W = 380
const CELL_H = 420
const LABEL_H = 36
const PREFIX = process.env.CROP_PREFIX ?? 'round12'
const SHEET_PREFIX = process.env.SHEET_PREFIX ?? 'shop-overlay-contact-pdp'

const WHITE_MUG_SLUGS = [
  'ceramic-mug-11oz-15oz-478',
  'mug-11oz-68',
  'mug-15oz-425',
  'white-ceramic-mug-11oz-503',
  'enamel-camping-mug-483',
  'coffee-mug-tumbler-15oz-1511',
]

const TARGET_SLUGS = [
  'dad-hat-with-leather-patch-round-1287',
  'dad-hat-with-leather-patch-rectangle-1221',
  'mid-profile-baseball-cap-with-leather-patch-rect-2707',
  'posicharge-competitor-7-pocketed-short-4616',
  'posicharge-competitor-short-4127',
  'candle-set-with-wick-trimmer-5453',
  'circle-necklace-engraving-2341',
  'heart-necklace-engraving-2655',
  'colored-frame-posters-5651',
  'natural-stone-stretch-bar-bracelet-engraving-2651',
  'tote-bag-aop-1389',
  'picnic-blanket-1124',
  'classic-cuffed-beanie-embroidery-1691',
  'cuff-beanie-5385',
  'snapback-trucker-cap-1446',
  'kiss-cut-stickers-400',
  'tough-phone-cases-269',
  ...WHITE_MUG_SLUGS,
]

const manifestPath = path.join(ARTIFACTS, 'shop-overlay-contact-manifest.json')
if (!existsSync(manifestPath)) {
  console.error(`Missing manifest: ${manifestPath} (run render-shop-overlay-contact-sheet.mjs first)`)
  process.exit(1)
}

/** @type {{ pages: { page: number, slugs: string[] }[] }} */
const manifest = JSON.parse(readFileSync(manifestPath, 'utf8'))
const slugToTile = new Map()
for (const { page, slugs } of manifest.pages) {
  slugs.forEach((slug, indexInPage) => {
    slugToTile.set(slug, { page, indexInPage })
  })
}

mkdirSync(ARTIFACTS, { recursive: true })

const failures = []

for (const slug of [...new Set(TARGET_SLUGS)]) {
  const pos = slugToTile.get(slug)
  if (!pos) {
    failures.push(`${slug}: not on contact sheet (hidden or render skip)`)
    continue
  }
  const sheet = path.join(ARTIFACTS, `${SHEET_PREFIX}-page${pos.page}.png`)
  if (!existsSync(sheet)) {
    failures.push(`${slug}: missing sheet ${sheet}`)
    continue
  }
  const row = Math.floor(pos.indexInPage / COLS)
  const col = pos.indexInPage % COLS
  const left = col * CELL_W
  const top = row * CELL_H
  const out = path.join(ARTIFACTS, `${PREFIX}-crop-${slug}.png`)
  await sharp(sheet).extract({ left, top, width: CELL_W, height: CELL_H }).png().toFile(out)

  const labelBand = await sharp(out)
    .extract({ left: 0, top: CELL_H - LABEL_H, width: CELL_W, height: LABEL_H })
    .raw()
    .toBuffer()
  let darkPx = 0
  for (let i = 0; i < labelBand.length; i += 3) {
    const lum = (labelBand[i] + labelBand[i + 1] + labelBand[i + 2]) / 3
    if (lum < 80) darkPx++
  }
  if (darkPx < 24) {
    failures.push(`${slug}: label band looks empty (darkPx=${darkPx})`)
  }
  console.log(`crop ${slug} page=${pos.page} tile=${pos.indexInPage} → ${out}`)
}

if (failures.length) {
  console.warn('\nCrop notes:')
  for (const line of failures) console.warn(`  - ${line}`)
}
console.log(`\nWrote crops (prefix=${PREFIX}) for ${TARGET_SLUGS.length} requested slugs → ${ARTIFACTS}`)
