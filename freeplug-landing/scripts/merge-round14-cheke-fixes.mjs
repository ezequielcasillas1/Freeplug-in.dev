#!/usr/bin/env node
/** Cheke: unhide 2651/5651 on clean slides; fix 1221 leather patch mark. */
import { readFileSync, writeFileSync } from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const OVERRIDES = path.join(__dirname, '../src/lib/merch/shop/shop-gallery-placements-overrides.json')

/** ~70% of visible rectangle leather patch — light (cream) wordmark on brown leather. */
const LEATHER_RECT_PATCH = { top: 0.36, left: 0.5, width: 0.16, inkBlankKind: 'dark' }
const BRACELET_BAR = { top: 0.44, left: 0.5, width: 0.24, inkBlankKind: 'light' }
const POSTER_FACE = { top: 0.44, left: 0.5, width: 0.24, inkBlankKind: 'light' }

/** @type {Record<string, { slides: object[] }>} */
const ROUND14 = {
  'dad-hat-with-leather-patch-rectangle-1221': {
    slides: [{ ...LEATHER_RECT_PATCH }, { ...LEATHER_RECT_PATCH }],
  },
  'natural-stone-stretch-bar-bracelet-engraving-2651': {
    slides: [{ hide: true }, { ...BRACELET_BAR }],
  },
  'colored-frame-posters-5651': {
    slides: [{ hide: true }, { ...POSTER_FACE }],
  },
}

const doc = JSON.parse(readFileSync(OVERRIDES, 'utf8'))
doc.bySlug = { ...doc.bySlug, ...ROUND14 }
writeFileSync(OVERRIDES, JSON.stringify(doc, null, 2) + '\n')
console.log(`Merged ${Object.keys(ROUND14).length} round-14 Cheke fixes → ${OVERRIDES}`)
