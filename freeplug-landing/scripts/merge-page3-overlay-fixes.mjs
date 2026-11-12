#!/usr/bin/env node
/**
 * Round 9b: page-3 contact regressions — hero slide pick, inkBlankKind on surface luminance, mark size.
 * inkBlankKind 'dark' = light wordmark on dark surface; 'light' = dark wordmark on light surface.
 */
import { readFileSync, writeFileSync } from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const OVERRIDES = path.join(__dirname, '../src/lib/merch/shop/shop-gallery-placements-overrides.json')

const MUG_BODY = { top: 0.5, left: 0.5, width: 0.22, inkBlankKind: 'light' }
const CAP_LIGHT = { top: 0.19, left: 0.5, width: 0.2, inkBlankKind: 'light' }
const CAP_DARK = { top: 0.19, left: 0.5, width: 0.2, inkBlankKind: 'dark' }
const BEANIE_CUFF = { top: 0.78, left: 0.5, width: 0.18, inkBlankKind: 'light' }
/** Front-panel leather patch (below crown button, above brim). */
const LEATHER_PATCH = { top: 0.36, left: 0.5, width: 0.16, inkBlankKind: 'dark' }
/** Jar/tin wrap label center on square mockups. */
const CANDLE_LABEL = { top: 0.54, left: 0.5, width: 0.2, inkBlankKind: 'light' }
const TIN_CANDLE_LABEL = { top: 0.62, left: 0.52, width: 0.22, inkBlankKind: 'light' }
const THIGH_LIGHT = { top: 0.66, left: 0.34, width: 0.18, inkBlankKind: 'dark' }

/** @type {Record<string, { slides: object[] }>} */
const PAGE3 = {
  'colorful-mugs-11oz-15oz-1151': { slides: [{ ...MUG_BODY }, { hide: true }] },
  'two-tone-accent-mug-11oz-15oz-2693': { slides: [{ ...MUG_BODY }, { hide: true }] },
  'classic-cuffed-beanie-embroidery-1691': { slides: [{ ...BEANIE_CUFF }, { hide: true }] },
  'dad-hat-with-leather-patch-rectangle-1221': {
    slides: [{ ...LEATHER_PATCH }, { ...LEATHER_PATCH }],
  },
  'dad-hat-with-leather-patch-round-1287': {
    slides: [{ ...LEATHER_PATCH }, { hide: true }],
  },
  'mid-profile-baseball-cap-with-leather-patch-rect-2707': {
    slides: [{ hide: true }, { ...LEATHER_PATCH, width: 0.13 }],
  },
  '5-panel-trucker-cap-1734': { slides: [{ ...CAP_LIGHT }, { ...CAP_LIGHT }] },
  'cuff-beanie-5385': { slides: [{ ...BEANIE_CUFF }, { ...BEANIE_CUFF }] },
  'action-snapback-cap-5284': { slides: [{ ...CAP_LIGHT }, { ...CAP_LIGHT }] },
  'canvas-mesh-back-cap-4802': { slides: [{ ...CAP_DARK }, { ...CAP_DARK }] },
  'snapback-trucker-cap-1743': { slides: [{ ...CAP_LIGHT }, { ...CAP_LIGHT }] },
  'impact-mesh-stretch-tek-cap-5625': { slides: [{ ...CAP_LIGHT }, { ...CAP_LIGHT }] },
  'snapback-trucker-cap-1446': { slides: [{ ...CAP_DARK }, { ...CAP_DARK }] },
  '12-solid-cuffed-beanie-5665': {
    slides: [{ hide: true }, { top: 0.36, left: 0.5, width: 0.2, inkBlankKind: 'dark' }],
  },
  'full-length-apron-5541': {
    slides: [{ hide: true }, { top: 0.42, left: 0.5, width: 0.2, inkBlankKind: 'dark' }],
  },
  'vacuum-insulated-tumbler-11oz-604': {
    slides: [{ top: 0.48, left: 0.5, width: 0.2, inkBlankKind: 'light' }, { hide: true }],
  },
  'hardboard-coasters-with-cork-bottom-set-of-4-2764': {
    slides: [{ top: 0.5, left: 0.5, width: 0.22, inkBlankKind: 'light' }, { hide: true }],
  },
  'glass-cutting-board-938': {
    slides: [{ top: 0.46, left: 0.5, width: 0.22, inkBlankKind: 'light' }, { hide: true }],
  },
  'scented-soy-candles-with-black-lid-4-and-9oz-1943': { slides: [{ ...CANDLE_LABEL }, { hide: true }] },
  'scented-candles-coconut-apricot-wax-4oz-9oz-1488': { slides: [{ ...CANDLE_LABEL }, { hide: true }] },
  'scented-soy-candles-with-white-lid-9oz-755': { slides: [{ ...CANDLE_LABEL }, { hide: true }] },
  'candle-set-with-wick-trimmer-5453': { slides: [{ ...CANDLE_LABEL }, { hide: true }] },
  'scented-soy-candle-multi-size-amber-jar-1468': { slides: [{ ...CANDLE_LABEL }, { hide: true }] },
  'tin-candles-1379': { slides: [{ ...TIN_CANDLE_LABEL }, { hide: true }] },
  'posicharge-competitor-7-pocketed-short-4616': {
    slides: [{ top: 0.7, left: 0.28, width: 0.18, inkBlankKind: 'dark' }, { hide: true }],
  },
  'posicharge-competitor-short-4127': {
    slides: [{ hide: true }, { ...THIGH_LIGHT }],
  },
  'women-s-dare-shorts-5786': { slides: [{ ...THIGH_LIGHT }, { hide: true }] },
}

const doc = JSON.parse(readFileSync(OVERRIDES, 'utf8'))
doc.bySlug = { ...doc.bySlug, ...PAGE3 }
writeFileSync(OVERRIDES, JSON.stringify(doc, null, 2) + '\n')
console.log(`Merged ${Object.keys(PAGE3).length} page-3 overlay fixes → ${OVERRIDES}`)
