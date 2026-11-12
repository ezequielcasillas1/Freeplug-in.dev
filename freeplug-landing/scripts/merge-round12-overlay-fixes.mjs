#!/usr/bin/env node
/**
 * Round 12: white-mug ink/position, leather patch scale, candle label, necklace pendant,
 * shorts legs, picnic blanket, beanies.
 */
import { readFileSync, writeFileSync } from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const OVERRIDES = path.join(__dirname, '../src/lib/merch/shop/shop-gallery-placements-overrides.json')

const MUG_BODY = { top: 0.5, left: 0.5, width: 0.24, inkBlankKind: 'light' }
const PATCH = (top, width = 0.16) => ({ top, left: 0.5, width, inkBlankKind: 'dark' })
const BEANIE_CUFF = { top: 0.28, left: 0.5, width: 0.32, inkBlankKind: 'light' }
const BLANKET_FACE = { top: 0.52, left: 0.48, width: 0.3, inkBlankKind: 'dark' }
const BRACELET_BAR = { top: 0.44, left: 0.5, width: 0.18, inkBlankKind: 'dark' }
const SNAP_NAVY = { top: 0.34, left: 0.38, width: 0.28, inkBlankKind: 'dark' }
const SINGLE_THIGH = { top: 0.66, left: 0.24, width: 0.2, inkBlankKind: 'light' }
const GRID_SHORT = { top: 0.64, left: 0.36, width: 0.26, inkBlankKind: 'dark' }
const CANDLE_SET_LABEL = { top: 0.61, left: 0.52, width: 0.24, inkBlankKind: 'light' }
const PENDANT = { top: 0.44, left: 0.5, width: 0.17, inkBlankKind: 'dark' }

const WHITE_MUG_SLUGS = [
  'ceramic-mug-11oz-15oz-478',
  'mug-11oz-68',
  'mug-15oz-425',
  'white-ceramic-mug-11oz-503',
  'enamel-camping-mug-483',
  'coffee-mug-tumbler-15oz-1511',
]

/** @type {Record<string, { slides: object[] }>} */
const ROUND12 = {
  ...Object.fromEntries(WHITE_MUG_SLUGS.map((slug) => [slug, { slides: [{ ...MUG_BODY }, { hide: true }] }])),
  'classic-cuffed-beanie-embroidery-1691': { slides: [{ ...BEANIE_CUFF }, { hide: true }] },
  'cuff-beanie-5385': {
    slides: [{ ...BEANIE_CUFF, left: 0.48 }, { ...BEANIE_CUFF, top: 0.72, width: 0.28 }],
  },
  'dad-hat-with-leather-patch-rectangle-1221': {
    slides: [{ ...PATCH(0.36, 0.16) }, { ...PATCH(0.36, 0.16) }],
  },
  'dad-hat-with-leather-patch-round-1287': {
    slides: [{ ...PATCH(0.36, 0.22) }, { hide: true }],
  },
  'posicharge-competitor-7-pocketed-short-4616': {
    slides: [{ hide: true }, { ...SINGLE_THIGH }],
  },
  'posicharge-competitor-short-4127': {
    slides: [{ hide: true }, { ...GRID_SHORT }],
  },
  'snapback-trucker-cap-1446': { slides: [{ ...SNAP_NAVY }, { ...SNAP_NAVY, top: 0.32 }] },
  'picnic-blanket-1124': { slides: [{ ...BLANKET_FACE }, { hide: true }] },
  'natural-stone-stretch-bar-bracelet-engraving-2651': {
    slides: [{ hide: true }, { ...BRACELET_BAR }],
  },
  'circle-necklace-engraving-2341': {
    slides: [{ ...PENDANT }, { hide: true }],
  },
  'candle-set-with-wick-trimmer-5453': {
    slides: [{ ...CANDLE_SET_LABEL }, { hide: true }],
  },
  'mid-profile-baseball-cap-with-leather-patch-rect-2707': {
    slides: [{ hide: true }, { ...PATCH(0.36, 0.14) }],
  },
  'tough-phone-cases-269': {
    slides: [{ top: 0.54, left: 0.62, width: 0.18, inkBlankKind: 'light' }, { hide: true }],
  },
}

const doc = JSON.parse(readFileSync(OVERRIDES, 'utf8'))
doc.bySlug = { ...doc.bySlug, ...ROUND12 }
writeFileSync(OVERRIDES, JSON.stringify(doc, null, 2) + '\n')
console.log(`Merged ${Object.keys(ROUND12).length} round-12 fixes → ${OVERRIDES}`)
