#!/usr/bin/env node
import { readFileSync, writeFileSync } from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const OVERRIDES = path.join(__dirname, '../src/lib/merch/shop/shop-gallery-placements-overrides.json')

const CHEST = { top: 0.42, left: 0.5, width: 0.26, inkBlankKind: 'light' }
const SNAP = { top: 0.32, left: 0.36, width: 0.3, inkBlankKind: 'dark' }
const JEWEL = { top: 0.46, left: 0.5, width: 0.26, inkBlankKind: 'light' }
const BOWL = { top: 0.5, left: 0.5, width: 0.32, inkBlankKind: 'light' }
const SLEEVE = { top: 0.52, left: 0.5, width: 0.3, inkBlankKind: 'light' }
const WALL = { top: 0.44, left: 0.5, width: 0.28, inkBlankKind: 'light' }

const FIX = {
  'unisex-hd-cotton-t-shirt-1439': { slides: [{ top: 0.42, left: 0.5, width: 0.22, inkBlankKind: 'light' }, { top: 0.42, left: 0.5, width: 0.22, inkBlankKind: 'light' }] },
  'featherweight-french-terry-long-sleeve-crewneck-3472': {
    slides: [{ top: 0.42, left: 0.5, width: 0.22, inkBlankKind: 'light' }, { hide: true }],
  },
  'circle-necklace-engraving-2341': { slides: [{ ...JEWEL }, { hide: true }] },
  'heart-necklace-engraving-2655': { slides: [{ ...JEWEL }, { hide: true }] },
  'horizontal-bar-necklace-engraving-2654': { slides: [{ ...JEWEL }, { hide: true }] },
  'cutout-heart-bar-necklace-engraving-2659': { slides: [{ ...JEWEL }, { hide: true }] },
  'cutout-paw-bar-necklace-engraving-2652': { slides: [{ ...JEWEL }, { hide: true }] },
  'pet-bowl-18oz-engraving-1520': { slides: [{ ...BOWL }, { hide: true }] },
  'laptop-sleeve-648': { slides: [{ ...SLEEVE }, { hide: true }] },
  'matte-canvas-framed-multi-color-944': { slides: [{ ...WALL }, { hide: true }] },
  'framed-vertical-poster-540': { slides: [{ ...WALL }, { hide: true }] },
}

const doc = JSON.parse(readFileSync(OVERRIDES, 'utf8'))
doc.bySlug = { ...doc.bySlug, ...FIX }
writeFileSync(OVERRIDES, JSON.stringify(doc, null, 2) + '\n')
console.log(`Merged ${Object.keys(FIX).length} round-16 visibility failure fixes`)
