#!/usr/bin/env node
/** Round 15: hide 6 necklace + bandana; fix 1446 flat hero + 4616 left-leg mark. */
import { readFileSync, writeFileSync } from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const OVERRIDES = path.join(__dirname, '../src/lib/merch/shop/shop-gallery-placements-overrides.json')

const SHORTS_LEFT_LEG = { top: 0.46, left: 0.38, width: 0.17, inkBlankKind: 'light' }

/** @type {Record<string, { slides: object[] }>} */
const ROUND19 = {
  'posicharge-competitor-7-pocketed-short-4616': {
    slides: [{ ...SHORTS_LEFT_LEG }, { hide: true }],
  },
}

const doc = JSON.parse(readFileSync(OVERRIDES, 'utf8'))
doc.bySlug = { ...doc.bySlug, ...ROUND19 }
writeFileSync(OVERRIDES, JSON.stringify(doc, null, 2) + '\n')
console.log(`Merged ${Object.keys(ROUND19).length} round-19 placement fixes`)
