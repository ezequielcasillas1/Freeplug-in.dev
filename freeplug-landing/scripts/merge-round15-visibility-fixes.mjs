#!/usr/bin/env node
/** Widen marks for PDP visibility + halftime hoodie ink. */
import { readFileSync, writeFileSync } from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const OVERRIDES = path.join(__dirname, '../src/lib/merch/shop/shop-gallery-placements-overrides.json')
const CATALOG = path.join(__dirname, '../src/lib/merch/shop/shop-catalog.json')

const catalog = JSON.parse(readFileSync(CATALOG, 'utf8'))
const doc = JSON.parse(readFileSync(OVERRIDES, 'utf8'))

const PENDANT = { top: 0.46, left: 0.5, width: 0.2, inkBlankKind: 'dark' }
const BAR = { top: 0.44, left: 0.5, width: 0.2, inkBlankKind: 'dark' }
const BOWL = { top: 0.52, left: 0.5, width: 0.24, inkBlankKind: 'dark' }
const HALFTIME = { top: 0.42, left: 0.42, width: 0.24, inkBlankKind: 'dark' }

const ROUND15 = {
  'halftime-long-sleeve-hoodie-3155': { slides: [{ ...HALFTIME }, { hide: true }] },
  'pet-bowl-18oz-engraving-1520': { slides: [{ ...BOWL }, { hide: true }] },
}

for (const item of catalog.items) {
  if (/necklace-engraving/.test(item.slug) && !ROUND15[item.slug]) {
    ROUND15[item.slug] = { slides: [{ ...PENDANT }, { hide: true }] }
  }
  if (/bar-necklace-engraving/.test(item.slug)) {
    ROUND15[item.slug] = { slides: [{ ...BAR }, { hide: true }] }
  }
}

doc.bySlug = { ...doc.bySlug, ...ROUND15 }
writeFileSync(OVERRIDES, JSON.stringify(doc, null, 2) + '\n')
console.log(`Merged ${Object.keys(ROUND15).length} round-15 visibility fixes → ${OVERRIDES}`)
