#!/usr/bin/env node
import { readFileSync, writeFileSync } from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const OVERRIDES = path.join(__dirname, '../src/lib/merch/shop/shop-gallery-placements-overrides.json')

/** Lifestyle slide: blank engraving bar on wrist (slide 0). Product-only slide 1 has baked ENGRAVE copy. */
const JEWELRY_MARK = { top: 0.56, left: 0.48, width: 0.17, inkBlankKind: 'dark' }
const STICKER_MARK = { top: 0.5, left: 0.5, width: 0.26, inkBlankKind: 'light' }
const MUG_BODY = { top: 0.5, left: 0.5, width: 0.22, inkBlankKind: 'light' }
const CAP_FRONT = { top: 0.19, left: 0.5, width: 0.18 }
const BEANIE = { top: 0.34, left: 0.5, width: 0.17 }
const THIGH = { top: 0.66, left: 0.34, width: 0.17, inkBlankKind: 'dark' }

/** @type {Record<string, { slides: object[] }>} */
const ROUND9 = {
  'natural-stone-stretch-bar-bracelet-engraving-2651': { slides: [{ ...JEWELRY_MARK }, { hide: true }] },
  'circle-necklace-engraving-2341': { slides: [{ ...JEWELRY_MARK }, { hide: true }] },
  'heart-necklace-engraving-2655': { slides: [{ ...JEWELRY_MARK }, { hide: true }] },
  'horizontal-bar-necklace-engraving-2654': { slides: [{ ...JEWELRY_MARK }, { hide: true }] },
  'cutout-heart-bar-necklace-engraving-2659': { slides: [{ ...JEWELRY_MARK }, { hide: true }] },
  'cutout-paw-bar-necklace-engraving-2652': { slides: [{ ...JEWELRY_MARK }, { hide: true }] },
  'leatherette-ornament-3-shapes-engraving-2756': { slides: [{ top: 0.44, left: 0.5, width: 0.18, inkBlankKind: 'dark' }, { hide: true }] },
  'pet-bowl-18oz-engraving-1520': { slides: [{ top: 0.46, left: 0.5, width: 0.2, inkBlankKind: 'dark' }, { hide: true }] },
  'pu-leather-phone-cases-engraving-5369': {
    slides: [{ top: 0.52, left: 0.5, width: 0.2, inkBlankKind: 'dark' }, { hide: true }],
  },
  'kiss-cut-stickers-400': { slides: [{ hide: true }, { ...STICKER_MARK }] },
  'die-cut-stickers-600': { slides: [{ ...STICKER_MARK }, { hide: true }] },
  'sticker-sheets-661': { slides: [{ ...STICKER_MARK }, { hide: true }] },
  'kiss-cut-sticker-sheet-5372': { slides: [{ hide: true }, { ...STICKER_MARK }] },
  'round-vinyl-stickers-564': { slides: [{ hide: true }, { ...STICKER_MARK, width: 0.22 }] },
  'transparent-outdoor-stickers-square-1pc-794': { slides: [{ hide: true }, { ...STICKER_MARK }] },
  'square-stickers-384': { slides: [{ top: 0.5, left: 0.5, width: 0.28, inkBlankKind: 'dark' }, { hide: true }] },
  'colorful-mugs-11oz-15oz-1151': {
    slides: [{ hide: true }, { top: 0.5, left: 0.5, width: 0.22, inkBlankKind: 'dark' }],
  },
  'two-tone-accent-mug-11oz-15oz-2693': { slides: [{ hide: true }, { ...MUG_BODY }] },
  'accent-coffee-mug-11-15oz-635': { slides: [{ ...MUG_BODY }, { hide: true }] },
  'accent-rim-handle-mug-2692': { slides: [{ ...MUG_BODY }, { hide: true }] },
  '11oz-accent-mug-583': { slides: [{ ...MUG_BODY }, { hide: true }] },
  'dad-hat-with-leather-patch-rectangle-1221': {
    slides: [
      { top: 0.168, left: 0.5, width: 0.16, inkBlankKind: 'light' },
      { top: 0.168, left: 0.5, width: 0.16, inkBlankKind: 'light' },
    ],
  },
  'dad-hat-with-leather-patch-round-1287': {
    slides: [
      { top: 0.168, left: 0.5, width: 0.15, inkBlankKind: 'light' },
      { hide: true },
    ],
  },
  '5-panel-trucker-cap-1734': { slides: [{ ...CAP_FRONT }, { ...CAP_FRONT }] },
  'cuff-beanie-5385': { slides: [{ ...BEANIE }, { ...BEANIE }] },
  'canvas-mesh-back-cap-4802': { slides: [{ ...CAP_FRONT }, { ...CAP_FRONT }] },
  'snapback-trucker-cap-1446': { slides: [{ ...CAP_FRONT }, { ...CAP_FRONT }] },
  'impact-mesh-stretch-tek-cap-5625': { slides: [{ ...CAP_FRONT }, { ...CAP_FRONT }] },
  'posicharge-competitor-7-pocketed-short-4616': {
    slides: [{ top: 0.7, left: 0.28, width: 0.17, inkBlankKind: 'dark' }, { hide: true }],
  },
  'posicharge-competitor-2-button-henley-4129': {
    slides: [{ top: 0.42, left: 0.5, width: 0.22, inkBlankKind: 'light' }, { hide: true }],
  },
  'unisex-pique-gym-shorts-6173': {
    slides: [{ hide: true }, { top: 0.66, left: 0.34, width: 0.17, inkBlankKind: 'light' }],
  },
  'vacuum-insulated-tumbler-11oz-604': { slides: [{ top: 0.48, left: 0.5, width: 0.18, inkBlankKind: 'light' }, { hide: true }] },
  'glass-cutting-board-938': { slides: [{ top: 0.46, left: 0.5, width: 0.2, inkBlankKind: 'light' }, { hide: true }] },
  'hardboard-coasters-with-cork-bottom-set-of-4-2764': {
    slides: [{ top: 0.5, left: 0.5, width: 0.22, inkBlankKind: 'light' }, { hide: true }],
  },
  'paper-gift-bag-2729': { slides: [{ top: 0.52, left: 0.5, width: 0.18, inkBlankKind: 'light' }, { hide: true }] },
  'scented-soy-candle-multi-size-amber-jar-1468': {
    slides: [{ top: 0.4, left: 0.5, width: 0.18, inkBlankKind: 'light' }, { hide: true }],
  },
  'tin-candles-1379': { slides: [{ top: 0.4, left: 0.5, width: 0.18, inkBlankKind: 'light' }, { hide: true }] },
  'unisex-fleece-zip-up-hoodie-1925': {
    slides: [{ hide: true }, { top: 0.42, left: 0.58, width: 0.13, inkBlankKind: 'dark' }],
  },
  'repeat-1-2-zip-long-sleeve-hooded-jacket-4397': {
    slides: [{ hide: true }, { top: 0.42, left: 0.58, width: 0.13, inkBlankKind: 'light' }],
  },
  'toddler-full-zip-fleece-hoodie-2728': {
    slides: [{ hide: true }, { top: 0.42, left: 0.58, width: 0.13, inkBlankKind: 'dark' }],
  },
  'canvas-tote-bag-5-color-straps-507': {
    slides: [
      { top: 0.72, left: 0.5, width: 0.17, inkBlankKind: 'light' },
      { top: 0.56, left: 0.44, width: 0.17, inkBlankKind: 'light' },
    ],
  },
  'cotton-canvas-tote-bag-1313': {
    slides: [
      { top: 0.56, left: 0.46, width: 0.17, inkBlankKind: 'light' },
      { top: 0.56, left: 0.44, width: 0.17, inkBlankKind: 'light' },
    ],
  },
  'cotton-tote-bag-553': {
    slides: [
      { top: 0.5, left: 0.27, width: 0.17, inkBlankKind: 'light' },
      { hide: true },
    ],
  },
  'insulated-lunch-tote-5123': {
    slides: [
      { top: 0.58, left: 0.46, width: 0.17, inkBlankKind: 'dark' },
      { hide: true },
    ],
  },
  'fanny-pack-468': { slides: [{ top: 0.54, left: 0.46, width: 0.17, inkBlankKind: 'light' }, { hide: true }] },
  'mid-profile-baseball-cap-with-leather-patch-rect-2707': {
    slides: [
      { hide: true },
      { top: 0.168, left: 0.5, width: 0.11, inkBlankKind: 'dark' },
    ],
  },
  'full-length-apron-5541': { slides: [{ hide: true }, { top: 0.44, left: 0.5, width: 0.17, inkBlankKind: 'dark' }] },
  'posicharge-competitor-short-4127': {
    slides: [{ hide: true }, { top: 0.66, left: 0.34, width: 0.17, inkBlankKind: 'dark' }],
  },
  'unisex-flyer-jogger-4628': {
    slides: [{ hide: true }, { top: 0.66, left: 0.34, width: 0.17, inkBlankKind: 'dark' }],
  },
  'women-s-dare-shorts-5786': {
    slides: [{ top: 0.66, left: 0.34, width: 0.17, inkBlankKind: 'dark' }, { hide: true }],
  },
  'wooden-ornaments-697': { slides: [{ hide: true }, { top: 0.38, left: 0.62, width: 0.17, inkBlankKind: 'light' }] },
  'sublimation-crew-socks-1433': { slides: [{ top: 0.58, left: 0.5, width: 0.17, inkBlankKind: 'light' }, { hide: true }] },
  'tough-phone-cases-269': { slides: [{ top: 0.52, left: 0.5, width: 0.18, inkBlankKind: 'light' }, { hide: true }] },
  'slim-phone-cases-268': { slides: [{ top: 0.52, left: 0.5, width: 0.18, inkBlankKind: 'light' }, { hide: true }] },
  'laptop-sleeve-429': { slides: [{ top: 0.48, left: 0.5, width: 0.17, inkBlankKind: 'light' }, { hide: true }] },
  'desk-mat-488': { slides: [{ top: 0.46, left: 0.5, width: 0.17, inkBlankKind: 'light' }, { hide: true }] },
}

const doc = JSON.parse(readFileSync(OVERRIDES, 'utf8'))
doc.bySlug = { ...doc.bySlug, ...ROUND9 }
writeFileSync(OVERRIDES, JSON.stringify(doc, null, 2) + '\n')
console.log(`Merged ${Object.keys(ROUND9).length} round-9 overrides → ${OVERRIDES}`)
