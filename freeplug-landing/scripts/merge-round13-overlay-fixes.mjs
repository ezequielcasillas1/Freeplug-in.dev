#!/usr/bin/env node
/** Round 13 review: placements + Cheke hides (2651, 5651). */
import { readFileSync, writeFileSync } from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const OVERRIDES = path.join(__dirname, '../src/lib/merch/shop/shop-gallery-placements-overrides.json')

const PATCH_RECT_LIGHT = { top: 0.36, left: 0.5, width: 0.22, inkBlankKind: 'light' }
const SHORTS_LEFT_LEG = { top: 0.38, left: 0.42, width: 0.32, inkBlankKind: 'light' }
const CANDLE_LABEL = { top: 0.61, left: 0.4, width: 0.22, inkBlankKind: 'light' }
const BLANKET_WHITE = { top: 0.46, left: 0.52, width: 0.32, inkBlankKind: 'light' }
const SNAP_NAVY = { top: 0.33, left: 0.4, width: 0.26, inkBlankKind: 'dark' }
const TOTE_BODY = { top: 0.56, left: 0.5, width: 0.26, inkBlankKind: 'light' }
const HEART_PENDANT = { top: 0.46, left: 0.5, width: 0.22, inkBlankKind: 'light' }

/** @type {Record<string, { slides: object[] }>} */
const ROUND13 = {
  'dad-hat-with-leather-patch-rectangle-1221': {
    slides: [{ ...PATCH_RECT_LIGHT }, { ...PATCH_RECT_LIGHT }],
  },
  'posicharge-competitor-7-pocketed-short-4616': {
    slides: [{ hide: true }, { ...SHORTS_LEFT_LEG }],
  },
  'candle-set-with-wick-trimmer-5453': {
    slides: [{ ...CANDLE_LABEL }, { hide: true }],
  },
  'picnic-blanket-1124': { slides: [{ ...BLANKET_WHITE }, { hide: true }] },
  'snapback-trucker-cap-1446': { slides: [{ ...SNAP_NAVY }, { ...SNAP_NAVY, top: 0.31, left: 0.42 }] },
  'tote-bag-aop-1389': { slides: [{ ...TOTE_BODY }, { hide: true }] },
  'heart-necklace-engraving-2655': { slides: [{ ...HEART_PENDANT }, { hide: true }] },
}

const doc = JSON.parse(readFileSync(OVERRIDES, 'utf8'))
doc.bySlug = { ...doc.bySlug, ...ROUND13 }
writeFileSync(OVERRIDES, JSON.stringify(doc, null, 2) + '\n')
console.log(`Merged ${Object.keys(ROUND13).length} round-13 fixes → ${OVERRIDES}`)
