#!/usr/bin/env node
/**
 * Round 10 review crops from full PDP contact sheets (pages 1–5).
 */
import { mkdirSync, readFileSync } from 'node:fs'
import path from 'node:path'
import sharp from 'sharp'

const ARTIFACTS = '/opt/cursor/artifacts'
const PER_PAGE = 40
const COLS = 5
const CELL_W = 380
const CELL_H = 420
const PREFIX = 'round10'

/** Page-3 regressions + grid-readability + tumbler */
const TARGET_SLUGS = [
  'classic-cuffed-beanie-embroidery-1691',
  'cuff-beanie-5385',
  'chill-wine-tumbler-620',
  'accent-rim-handle-mug-11oz-15oz-2692',
  'dad-hat-with-leather-patch-round-1287',
  'mid-profile-baseball-cap-with-leather-patch-rect-2707',
  'posicharge-competitor-7-pocketed-short-4616',
  'vacuum-insulated-tumbler-11oz-604',
  'square-stickers-384',
  'posicharge-competitor-short-4127',
  'snapback-trucker-cap-1446',
]

const catalog = JSON.parse(
  readFileSync(path.join(process.cwd(), 'src/lib/merch/shop/shop-catalog.json'), 'utf8')
)
const slugToIndex = new Map(catalog.items.map((item, i) => [item.slug, i]))

mkdirSync(ARTIFACTS, { recursive: true })

for (let page = 1; page <= 5; page++) {
  const sheet = path.join(ARTIFACTS, `shop-overlay-contact-pdp-page${page}.png`)
  const { data, info } = await sharp(sheet).raw().toBuffer({ resolveWithObject: true })
  const pageStart = (page - 1) * PER_PAGE

  for (const slug of TARGET_SLUGS) {
    const idx = slugToIndex.get(slug)
    if (idx == null) continue
    const tileInPage = idx - pageStart
    if (tileInPage < 0 || tileInPage >= PER_PAGE) continue
    const row = Math.floor(tileInPage / COLS)
    const col = tileInPage % COLS
    const left = col * CELL_W
    const top = row * CELL_H
    await sharp(data, { raw: { width: info.width, height: info.height, channels: info.channels } })
      .extract({ left, top, width: CELL_W, height: CELL_H })
      .png()
      .toFile(path.join(ARTIFACTS, `${PREFIX}-crop-${slug}.png`))
  }
}

console.log(`Wrote round-10 crops for ${TARGET_SLUGS.length} slugs (when present per page) → ${ARTIFACTS}`)
