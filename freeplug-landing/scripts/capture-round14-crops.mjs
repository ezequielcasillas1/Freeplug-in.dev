#!/usr/bin/env node
/** Labeled crops for round-14 eye-review slugs only. */
import { spawnSync } from 'node:child_process'

process.env.CROP_PREFIX = 'round14'
process.env.SHEET_PREFIX = process.env.SHEET_PREFIX ?? 'round14-contact-pdp'
process.env.ROUND14_SLUGS = [
  'kiss-cut-stickers-400',
  'colored-frame-posters-5651',
  'natural-stone-stretch-bar-bracelet-engraving-2651',
  'circle-necklace-engraving-2341',
  'heart-necklace-engraving-2655',
  'horizontal-bar-necklace-engraving-2654',
  'cutout-heart-bar-necklace-engraving-2659',
  'cutout-paw-bar-necklace-engraving-2652',
  'wooden-ornaments-697',
  'clip-on-pet-bandana-1672',
  'dad-hat-with-leather-patch-rectangle-1221',
  'snapback-trucker-cap-1446',
  'picnic-blanket-1124',
  'posicharge-competitor-7-pocketed-short-4616',
  'unisex-joggers-embroidery-1903',
].join(',')

const r = spawnSync('node', ['scripts/capture-round14-crops-targets.mjs'], {
  cwd: process.cwd(),
  stdio: 'inherit',
  env: { ...process.env },
})
process.exit(r.status ?? 1)
