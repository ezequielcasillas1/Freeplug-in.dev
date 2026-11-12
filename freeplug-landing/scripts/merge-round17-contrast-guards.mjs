#!/usr/bin/env node
import { readFileSync, writeFileSync } from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const OVERRIDES = path.join(__dirname, '../src/lib/merch/shop/shop-gallery-placements-overrides.json')

const FIX = {
  'women-s-perfect-tri-long-sleeve-hoodie-2831': {
    slides: [{ top: 0.4, left: 0.44, width: 0.24, inkBlankKind: 'dark' }, { hide: true }],
  },
  'women-s-perfect-tri-midi-long-sleeve-hoodie-3809': {
    slides: [{ top: 0.38, left: 0.44, width: 0.22, inkBlankKind: 'dark' }, { hide: true }],
  },
  'essential-zip-tote-5098': {
    slides: [{ top: 0.52, left: 0.46, width: 0.24, inkBlankKind: 'dark' }, { hide: true }],
  },
  'beach-wash-tote-5106': {
    slides: [{ top: 0.52, left: 0.46, width: 0.24, inkBlankKind: 'dark' }, { hide: true }],
  },
  'snapback-trucker-cap-1743': {
    slides: [
      { top: 0.33, left: 0.4, width: 0.28, inkBlankKind: 'dark' },
      { top: 0.33, left: 0.4, width: 0.28, inkBlankKind: 'dark' },
    ],
  },
  'matte-canvas-framed-multi-color-944': {
    slides: [{ top: 0.52, left: 0.5, width: 0.2, inkBlankKind: 'light' }, { hide: true }],
  },
  'snapback-trucker-cap-1446': {
    slides: [
      { top: 0.33, left: 0.4, width: 0.26, inkBlankKind: 'light' },
      { top: 0.31, left: 0.42, width: 0.26, inkBlankKind: 'light' },
    ],
  },
}

const doc = JSON.parse(readFileSync(OVERRIDES, 'utf8'))
doc.bySlug = { ...doc.bySlug, ...FIX }
writeFileSync(OVERRIDES, JSON.stringify(doc, null, 2) + '\n')
console.log(`Merged ${Object.keys(FIX).length} round-17 contrast guard fixes`)
