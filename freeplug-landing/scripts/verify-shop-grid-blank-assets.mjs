#!/usr/bin/env node
/** Verify every shop catalog grid/gallery path exists on disk (run in CI / before upload). */
import { existsSync, readFileSync } from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const ROOT = path.join(__dirname, '..')
const catalog = JSON.parse(readFileSync(path.join(ROOT, 'src/lib/merch/shop/shop-catalog.json'), 'utf8'))
const missing = []
const seen = new Set()
for (const item of catalog.items) {
  const paths = new Set([item.gridImage, ...(item.gallery ?? [])])
  for (const src of paths) {
    if (!src || seen.has(src)) continue
    seen.add(src)
    const file = path.join(ROOT, 'public', src.replace(/^\//, ''))
    if (!existsSync(file)) missing.push({ slug: item.slug, src })
  }
}
if (missing.length) {
  console.error(`Missing ${missing.length} blank assets:`)
  for (const m of missing) console.error(m.slug, m.src)
  process.exit(1)
}
console.log(`OK: ${seen.size} unique blank asset paths for ${catalog.items.length} items`)
