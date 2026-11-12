#!/usr/bin/env node
/**
 * Round 10: worn beanie cuff, drinkware overrides, grid-readable marks, tumbler scale.
 */
import { readFileSync, writeFileSync } from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const OVERRIDES = path.join(__dirname, '../src/lib/merch/shop/shop-gallery-placements-overrides.json')

const MUG_BODY = { top: 0.5, left: 0.5, width: 0.24, inkBlankKind: 'light' }
const TUMBLER_BODY = { top: 0.5, left: 0.5, width: 0.38, inkBlankKind: 'light' }
/** Cuff on model's forehead — not chest (top 0.78). */
const BEANIE_CUFF_WORN = { top: 0.3, left: 0.5, width: 0.22, inkBlankKind: 'light' }
/** Flat lay / product-only beanie cuff. */
const BEANIE_CUFF_FLAT = { top: 0.72, left: 0.5, width: 0.2, inkBlankKind: 'light' }
const LEATHER_PATCH_FLAT = { top: 0.36, left: 0.5, width: 0.16, inkBlankKind: 'dark' }
const LEATHER_PATCH_WORN = { top: 0.28, left: 0.5, width: 0.17, inkBlankKind: 'dark' }
const THIGH_DARK = { top: 0.62, left: 0.36, width: 0.26, inkBlankKind: 'dark' }
const GRID_SHORT = { top: 0.62, left: 0.36, width: 0.26, inkBlankKind: 'dark' }
const GRID_STICKER = { top: 0.5, left: 0.5, width: 0.4, inkBlankKind: 'light' }
const GRID_CAP_WORN = { top: 0.31, left: 0.48, width: 0.28, inkBlankKind: 'dark' }

/** @type {Record<string, { slides: object[] }>} */
const ROUND10 = {
  'classic-cuffed-beanie-embroidery-1691': { slides: [{ ...BEANIE_CUFF_WORN }, { hide: true }] },
  'cuff-beanie-5385': {
    slides: [{ ...BEANIE_CUFF_WORN, left: 0.48 }, { ...BEANIE_CUFF_FLAT }],
  },
  'chill-wine-tumbler-620': {
    slides: [{ ...TUMBLER_BODY }, { ...TUMBLER_BODY, left: 0.5 }],
  },
  'accent-rim-handle-mug-11oz-15oz-2692': { slides: [{ ...MUG_BODY }, { hide: true }] },
  'vacuum-insulated-tumbler-11oz-604': {
    slides: [{ top: 0.5, left: 0.5, width: 0.38, inkBlankKind: 'light' }, { hide: true }],
  },
  'dad-hat-with-leather-patch-round-1287': {
    slides: [{ ...LEATHER_PATCH_FLAT, width: 0.18 }, { hide: true }],
  },
  'mid-profile-baseball-cap-with-leather-patch-rect-2707': {
    slides: [{ hide: true }, { top: 0.2, left: 0.5, width: 0.15, inkBlankKind: 'dark' }],
  },
  'posicharge-competitor-7-pocketed-short-4616': {
    slides: [{ hide: true }, { ...THIGH_DARK, top: 0.58, left: 0.4, width: 0.28 }],
  },
  'square-stickers-384': { slides: [{ ...GRID_STICKER }, { hide: true }] },
  'posicharge-competitor-short-4127': { slides: [{ hide: true }, { ...GRID_SHORT }] },
  'snapback-trucker-cap-1446': {
    slides: [{ ...GRID_CAP_WORN }, { ...GRID_CAP_WORN, top: 0.22 }],
  },
}

const doc = JSON.parse(readFileSync(OVERRIDES, 'utf8'))
doc.bySlug = { ...doc.bySlug, ...ROUND10 }
delete doc.bySlug['accent-rim-handle-mug-2692']
writeFileSync(OVERRIDES, JSON.stringify(doc, null, 2) + '\n')
console.log(`Merged ${Object.keys(ROUND10).length} round-10 fixes → ${OVERRIDES}`)
