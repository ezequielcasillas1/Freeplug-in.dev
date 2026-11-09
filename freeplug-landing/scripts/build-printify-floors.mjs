#!/usr/bin/env node
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const md = fs.readFileSync(
  '/home/ubuntu/.cursor/projects/agent-repos-Freeplug-in-dev/uploads/PRICING-REPORT_ffb4.md',
  'utf8',
)

const fromReport = {}
for (const row of md.split('\n').filter((l) => l.startsWith('| **'))) {
  const key = row.match(/`([a-z0-9-]+)`/)?.[1]
  const ships = row.match(/\$([\d.]+) \/ \$([\d.]+)/g)
  if (!key || !ships) continue
  const last = ships[ships.length - 1]
  const m = last.match(/\$([\d.]+) \/ \$([\d.]+)/)
  if (!m) continue
  fromReport[key] = { first: Math.round(parseFloat(m[1]) * 100), extra: Math.round(parseFloat(m[2]) * 100) }
}

const ALIAS = {
  'coaster-fp': 'coaster-set',
  'coaster-plug': 'coaster-set',
  'coaster-bolt': 'coaster-set',
  'coaster-charged': 'coaster-set',
  'pin-fp-mark': 'pin-set',
  'pin-plug': 'pin-set',
  'pin-bolt': 'pin-set',
  'kjv-bookmark-1': 'kjv-bookmarks',
  'kjv-bookmark-2': 'kjv-bookmarks',
  'kjv-bookmark-3': 'kjv-bookmarks',
  'kjv-bookmark-4': 'kjv-bookmarks',
}

/** Wave-1 Printify US floors (Cheke-approved coverage study). */
const WAVE1 = {
  'fully-charged-mug': { first: 749, extra: 349 },
  'cheap-free-latte-mug': { first: 749, extra: 349 },
  'know-a-plug-mug': { first: 949, extra: 399 },
  'day-one-tumbler': { first: 749, extra: 399 },
  'free-refills-travel-mug': { first: 749, extra: 399 },
  'stay-plugged-in-water-bottle': { first: 749, extra: 399 },
  'fp-circle-trucker-cap': { first: 699, extra: 300 },
  'fp-dad-hat': { first: 699, extra: 300 },
  'plugged-in-low-profile-cap': { first: 699, extra: 300 },
  'cuffed-beanie': { first: 699, extra: 300 },
  'hero-crewneck': { first: 799, extra: 209 },
  'running-over-candle': { first: 849, extra: 349 },
  'running-over-canvas': { first: 1399, extra: 449 },
  'running-over-pillow': { first: 1249, extra: 1199 },
  'come-on-in-doormat': { first: 2149, extra: 2049 },
  'plug-in-station-desk-mat': { first: 1099, extra: 749 },
  'build-plug-in-repeat-journal': { first: 799, extra: 400 },
  'fp-circle-keychain': { first: 849, extra: 349 },
  'sticker-fp-circle': { first: 549, extra: 75 },
  'sticker-know-a-plug': { first: 549, extra: 75 },
  'sticker-zero-price-tag': { first: 549, extra: 75 },
  'sticker-plug-heart': { first: 549, extra: 75 },
}

const OPTION_FLOOR = {
  'fully-charged-mug': {
    '11oz': { first: 749, extra: 349 },
    '15oz': { first: 949, extra: 399 },
  },
  'running-over-canvas': {
    '16x20': { first: 1399, extra: 449 },
    '24x36': { first: 1999, extra: 800 },
  },
}

const catalog = JSON.parse(
  fs.readFileSync(path.join(ROOT, 'src/lib/merch/collections/collections-catalog.json'), 'utf8'),
)

const floors = { ...WAVE1, ...fromReport }
for (const row of catalog) {
  if (floors[row.slug]) continue
  const alias = ALIAS[row.slug]
  if (alias && fromReport[alias]) floors[row.slug] = fromReport[alias]
}

const outPath = path.join(ROOT, 'src/lib/merch/collections/printify-shipping-floors.json')
fs.writeFileSync(outPath, JSON.stringify({ floors, optionFloors: OPTION_FLOOR, aliases: ALIAS }, null, 2) + '\n')
console.log('wrote', outPath, 'slug floors', Object.keys(floors).length)
