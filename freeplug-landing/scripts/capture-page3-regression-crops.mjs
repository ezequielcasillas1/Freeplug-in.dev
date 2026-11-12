#!/usr/bin/env node
import { mkdirSync, readFileSync } from 'node:fs'
import path from 'node:path'
import sharp from 'sharp'

const ARTIFACTS = '/opt/cursor/artifacts'
const PAGE = 3
const PER_PAGE = 40
const COLS = 5
const CELL_W = 380
const CELL_H = 420
const PREFIX = 'round9-page3'

const TARGET_SLUGS = [
  'classic-cuffed-beanie-embroidery-1691',
  'colorful-mugs-11oz-15oz-1151',
  'two-tone-accent-mug-11oz-15oz-2693',
  'dad-hat-with-leather-patch-rectangle-1221',
  'dad-hat-with-leather-patch-round-1287',
  '5-panel-trucker-cap-1734',
  'cuff-beanie-5385',
  'action-snapback-cap-5284',
  'canvas-mesh-back-cap-4802',
  'snapback-trucker-cap-1743',
  'impact-mesh-stretch-tek-cap-5625',
  'mid-profile-baseball-cap-with-leather-patch-rect-2707',
  'snapback-trucker-cap-1446',
  '12-solid-cuffed-beanie-5665',
  'full-length-apron-5541',
  'scented-soy-candles-with-black-lid-4-and-9oz-1943',
  'scented-candles-coconut-apricot-wax-4oz-9oz-1488',
  'tin-candles-1379',
  'candle-set-with-wick-trimmer-5453',
  'scented-soy-candle-multi-size-amber-jar-1468',
  'scented-soy-candles-with-white-lid-9oz-755',
  'glass-cutting-board-938',
  'hardboard-coasters-with-cork-bottom-set-of-4-2764',
  'vacuum-insulated-tumbler-11oz-604',
  'posicharge-competitor-7-pocketed-short-4616',
  'women-s-dare-shorts-5786',
]

const catalog = JSON.parse(
  readFileSync(path.join(process.cwd(), 'src/lib/merch/shop/shop-catalog.json'), 'utf8')
)
const slugToIndex = new Map(catalog.items.map((item, i) => [item.slug, i]))

mkdirSync(ARTIFACTS, { recursive: true })

const sheet = path.join(ARTIFACTS, 'shop-overlay-contact-pdp-page3.png')
const { data, info } = await sharp(sheet).raw().toBuffer({ resolveWithObject: true })

const pageStart = (PAGE - 1) * PER_PAGE

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

await sharp(sheet).png().toFile(path.join(ARTIFACTS, `${PREFIX}-contact-page3-full.png`))
console.log(`Wrote ${TARGET_SLUGS.length} crops + full page → ${ARTIFACTS}`)
