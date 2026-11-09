/**
 * Slim filled Printify map for runtime import.
 * Usage: gunzip -c printify-products.filled.json.gz | node scripts/slim-printify-products.mjs > out.json
 * Or: node scripts/slim-printify-products.mjs /path/to/filled.json
 */
import { readFileSync, writeFileSync } from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const inPath = process.argv[2]
let raw
if (inPath) {
  raw = readFileSync(inPath, 'utf8')
} else {
  raw = readFileSync(0, 'utf8')
}
const data = JSON.parse(raw)
const bySlug = data.bySlug ?? {}
const out = { bySlug: {} }
for (const [slug, row] of Object.entries(bySlug)) {
  const variants = Array.isArray(row.variants)
    ? row.variants.map((v) => ({
        id: v.id,
        productId: v.printifyProductId ?? v.productId,
        color: v.color ?? null,
        size: v.size ?? null,
        priceCents: v.priceCents ?? null,
        enabled: v.enabled !== false,
      }))
    : []
  out.bySlug[slug] = {
    printifyProductId: row.printifyProductId ?? null,
    printifyProductIds: row.printifyProductIds ?? (row.printifyProductId ? [row.printifyProductId] : []),
    productIdByVariant: row.productIdByVariant ?? {},
    variants,
    mockupsByColor: row.mockupsByColor ?? {},
  }
}
const outPath = path.join(__dirname, '../src/lib/merch/shop/printify-products.json')
writeFileSync(outPath, JSON.stringify(out))
console.log(`Wrote ${Object.keys(out.bySlug).length} slugs to ${outPath}`)
