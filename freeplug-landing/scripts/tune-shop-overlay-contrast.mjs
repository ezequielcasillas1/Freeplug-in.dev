#!/usr/bin/env node
/**
 * Flip inkBlankKind on failing grid heroes and write overrides entries.
 * Run after infer: node scripts/tune-shop-overlay-contrast.mjs
 */
import { existsSync, readFileSync, writeFileSync } from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const ROOT = path.join(__dirname, '..')
process.chdir(ROOT)

const { auditAllShopOverlayContrasts } = await import(
  '../src/lib/merch/shop/shop-overlay-contrast.ts'
)
const catalog = JSON.parse(
  readFileSync(path.join(ROOT, 'src/lib/merch/shop/shop-catalog.json'), 'utf8')
)
const OVERRIDES = path.join(ROOT, 'src/lib/merch/shop/shop-gallery-placements-overrides.json')

const failures = await auditAllShopOverlayContrasts(catalog.items)
if (!failures.length) {
  console.log('All grid heroes pass contrast audit.')
  process.exit(0)
}

const overrides = existsSync(OVERRIDES)
  ? JSON.parse(readFileSync(OVERRIDES, 'utf8'))
  : { bySlug: {} }
overrides.bySlug ??= {}

for (const f of failures) {
  const item = catalog.items.find((i) => i.slug === f.slug)
  if (!item) continue
  const flip = f.blankKind === 'light' ? 'dark' : 'light'
  const slide = item.gallery[f.slide]
  const existing = overrides.bySlug[f.slug]?.slides?.[f.slide]
  const base =
    existing && !existing.hide
      ? existing
      : JSON.parse(
          readFileSync(path.join(ROOT, 'src/lib/merch/shop/shop-gallery-placements.json'), 'utf8')
        ).bySlug[f.slug].slides[f.slide]
  if (!overrides.bySlug[f.slug]) overrides.bySlug[f.slug] = { slides: [] }
  overrides.bySlug[f.slug].slides[f.slide] = { ...base, inkBlankKind: flip, hide: false }
  console.log(`${f.slug} slide ${f.slide}: ink ${f.blankKind} -> ${flip} (was ${f.ratio.toFixed(2)}:1)`)
}

writeFileSync(OVERRIDES, JSON.stringify(overrides, null, 2) + '\n')
console.log(`Updated ${OVERRIDES} for ${failures.length} contrast fix(es). Re-run infer-shop-gallery-placements.mjs`)
