#!/usr/bin/env node
/**
 * Round 11: visible beanie dark ink, leather-patch scale, page 4–5 heroes.
 */
import { readFileSync, writeFileSync } from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const OVERRIDES = path.join(__dirname, '../src/lib/merch/shop/shop-gallery-placements-overrides.json')

/** ~70% of visible leather patch width on flat mocks. */
const PATCH_MARK = (top) => ({
  top,
  left: 0.5,
  width: 0.12,
  inkBlankKind: 'dark',
})
const BEANIE_CUFF = { top: 0.28, left: 0.5, width: 0.28, inkBlankKind: 'light' }
const SHORTS_WHITE = { top: 0.54, left: 0.42, width: 0.34, inkBlankKind: 'light' }
const SNAP_NAVY = { top: 0.35, left: 0.44, width: 0.26, inkBlankKind: 'dark' }
const BLANKET_FACE = { top: 0.48, left: 0.52, width: 0.24, inkBlankKind: 'light' }
const BRACELET_BAR = { top: 0.44, left: 0.5, width: 0.14, inkBlankKind: 'dark' }
const PHONE_WHITE = { top: 0.54, left: 0.62, width: 0.16, inkBlankKind: 'light' }

/** @type {Record<string, { slides: object[] }>} */
const ROUND11 = {
  'classic-cuffed-beanie-embroidery-1691': { slides: [{ ...BEANIE_CUFF }, { hide: true }] },
  'cuff-beanie-5385': { slides: [{ ...BEANIE_CUFF, left: 0.48 }, { ...BEANIE_CUFF, top: 0.72, width: 0.24 }] },
  'dad-hat-with-leather-patch-rectangle-1221': {
    slides: [{ ...PATCH_MARK(0.36) }, { ...PATCH_MARK(0.36) }],
  },
  'dad-hat-with-leather-patch-round-1287': {
    slides: [{ top: 0.36, left: 0.5, width: 0.2, inkBlankKind: 'dark' }, { hide: true }],
  },
  'mid-profile-baseball-cap-with-leather-patch-rect-2707': {
    slides: [{ hide: true }, { ...PATCH_MARK(0.19) }],
  },
  'posicharge-competitor-7-pocketed-short-4616': {
    slides: [{ hide: true }, { ...SHORTS_WHITE }],
  },
  'snapback-trucker-cap-1446': { slides: [{ ...SNAP_NAVY }, { ...SNAP_NAVY, top: 0.33 }] },
  'natural-stone-stretch-bar-bracelet-engraving-2651': {
    slides: [{ hide: true }, { ...BRACELET_BAR }],
  },
  'picnic-blanket-1124': { slides: [{ ...BLANKET_FACE }, { hide: true }] },
  'kiss-cut-stickers-400': {
    slides: [{ hide: true }, { top: 0.5, left: 0.5, width: 0.3, inkBlankKind: 'light' }],
  },
  'tough-phone-cases-269': { slides: [{ ...PHONE_WHITE }, { hide: true }] },
}

const doc = JSON.parse(readFileSync(OVERRIDES, 'utf8'))
doc.bySlug = { ...doc.bySlug, ...ROUND11 }
writeFileSync(OVERRIDES, JSON.stringify(doc, null, 2) + '\n')
console.log(`Merged ${Object.keys(ROUND11).length} round-11 fixes → ${OVERRIDES}`)
