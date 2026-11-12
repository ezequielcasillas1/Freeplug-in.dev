#!/usr/bin/env node
/** Round 14 human eye review — placements for 15 flagged heroes. */
import { readFileSync, writeFileSync } from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const OVERRIDES = path.join(__dirname, '../src/lib/merch/shop/shop-gallery-placements-overrides.json')

const PATCH = { top: 0.345, left: 0.5, width: 0.11, inkBlankKind: 'dark' }
const SNAP_PANEL = { top: 0.34, left: 0.49, width: 0.26, inkBlankKind: 'dark' }
const BLANKET = { top: 0.5, left: 0.5, width: 0.22, inkBlankKind: 'dark' }
const SHORTS_LEG = { top: 0.5, left: 0.28, width: 0.17, inkBlankKind: 'light' }
const JOGGER_THIGH = { top: 0.56, left: 0.4, width: 0.17, inkBlankKind: 'light' }
const PENDANT = { top: 0.71, left: 0.5, width: 0.17, inkBlankKind: 'light' }
const HEART_PENDANT = { top: 0.68, left: 0.5, width: 0.17, inkBlankKind: 'light' }
const ORNAMENT_WOOD = { top: 0.42, left: 0.56, width: 0.17, inkBlankKind: 'light' }
const BANDANA = { top: 0.66, left: 0.5, width: 0.18, inkBlankKind: 'light' }

/** @type {Record<string, { slides: object[] }>} */
const ROUND18 = {
  'dad-hat-with-leather-patch-rectangle-1221': { slides: [{ ...PATCH }, { ...PATCH }] },
  'snapback-trucker-cap-1446': { slides: [{ ...SNAP_PANEL }, { hide: true }] },
  'picnic-blanket-1124': { slides: [{ ...BLANKET }, { hide: true }] },
  'posicharge-competitor-7-pocketed-short-4616': { slides: [{ hide: true }, { ...SHORTS_LEG }] },
  'unisex-joggers-embroidery-1903': { slides: [{ ...JOGGER_THIGH }, { ...JOGGER_THIGH, left: 0.62 }] },
  'circle-necklace-engraving-2341': { slides: [{ hide: true }, { ...PENDANT }] },
  'heart-necklace-engraving-2655': { slides: [{ hide: true }, { ...HEART_PENDANT }] },
  'horizontal-bar-necklace-engraving-2654': { slides: [{ hide: true }, { ...PENDANT }] },
  'cutout-heart-bar-necklace-engraving-2659': { slides: [{ hide: true }, { ...PENDANT }] },
  'cutout-paw-bar-necklace-engraving-2652': { slides: [{ hide: true }, { ...PENDANT }] },
  'wooden-ornaments-697': { slides: [{ hide: true }, { ...ORNAMENT_WOOD }] },
  'clip-on-pet-bandana-1672': { slides: [{ hide: true }, { ...BANDANA }] },
}

const doc = JSON.parse(readFileSync(OVERRIDES, 'utf8'))
doc.bySlug = { ...doc.bySlug, ...ROUND18 }
writeFileSync(OVERRIDES, JSON.stringify(doc, null, 2) + '\n')
console.log(`Merged ${Object.keys(ROUND18).length} round-18 eye-review placements`)
