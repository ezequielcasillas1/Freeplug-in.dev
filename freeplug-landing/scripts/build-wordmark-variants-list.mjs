#!/usr/bin/env node
/**
 * Regenerates docs/merch/wordmark-variants-list.csv from shop + merch-store catalogs.
 * Run from freeplug-landing/: node scripts/build-wordmark-variants-list.mjs
 */
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const root = join(dirname(fileURLToPath(import.meta.url)), '..')
const outPath = join(root, 'docs/merch/wordmark-variants-list.csv')

const DEFAULT_WORDMARK = 'Freeplug.dev'
const bakedIds = new Set(
  JSON.parse(
    readFileSync(join(root, 'src/lib/merch/preview/wordmark-baked-printify-product-ids.json'), 'utf8')
  ).printifyProductIds
)
const shopCatalog = JSON.parse(readFileSync(join(root, 'src/lib/merch/shop/shop-catalog.json'), 'utf8'))
const printify = JSON.parse(readFileSync(join(root, 'src/lib/merch/shop/printify-products.json'), 'utf8'))
const collections = JSON.parse(
  readFileSync(join(root, 'src/lib/merch/collections/collections-catalog.json'), 'utf8')
)

function printifyIdsForShopSlug(slug) {
  const row = printify.bySlug?.[slug]
  if (!row) return []
  const ids = new Set()
  if (row.printifyProductId?.trim()) ids.add(row.printifyProductId.trim())
  for (const id of Object.values(row.productIdByVariant ?? {})) {
    if (typeof id === 'string' && id.trim()) ids.add(id.trim())
  }
  for (const v of row.variants ?? []) {
    if (v.productId?.trim()) ids.add(v.productId.trim())
  }
  return [...ids]
}

function shopBaked(slug) {
  return printifyIdsForShopSlug(slug).some((id) => bakedIds.has(id))
}

function csvEscape(value) {
  if (/[",\n]/.test(value)) return `"${value.replace(/"/g, '""')}"`
  return value
}

const rows = []
for (const item of shopCatalog.items) {
  rows.push({
    productName: item.title,
    catalogSource: 'buyer-shop',
    slug: item.slug,
    urlPath: `/shop/${item.slug}`,
    defaultWordmark: DEFAULT_WORDMARK,
    wordmarkBakedInPrintify: shopBaked(item.slug),
  })
}
for (const entry of collections) {
  rows.push({
    productName: entry.title,
    catalogSource: 'merch-store',
    slug: entry.slug,
    urlPath: `/merch/${entry.collection}/${entry.slug}`,
    defaultWordmark: DEFAULT_WORDMARK,
    wordmarkBakedInPrintify: true,
  })
}
rows.sort((a, b) =>
  a.catalogSource === b.catalogSource ? a.slug.localeCompare(b.slug) : a.catalogSource.localeCompare(b.catalogSource)
)

const header = [
  'product_name',
  'catalog_source',
  'slug',
  'url_path',
  'default_wordmark',
  'wordmark_baked_in_printify',
]
const lines = [header.join(',')]
for (const row of rows) {
  lines.push(
    [
      csvEscape(row.productName),
      row.catalogSource,
      row.slug,
      row.urlPath,
      csvEscape(row.defaultWordmark),
      row.wordmarkBakedInPrintify ? 'yes' : 'no',
    ].join(',')
  )
}
mkdirSync(dirname(outPath), { recursive: true })
writeFileSync(outPath, `${lines.join('\n')}\n`, 'utf8')

const summary = {
  total: rows.length,
  buyerShop: rows.filter((r) => r.catalogSource === 'buyer-shop').length,
  merchStore: rows.filter((r) => r.catalogSource === 'merch-store').length,
  bakedInPrintify: rows.filter((r) => r.wordmarkBakedInPrintify).length,
  swappableAtFulfillment: rows.filter((r) => !r.wordmarkBakedInPrintify).length,
}
console.log('Wrote', outPath)
console.log(JSON.stringify(summary, null, 2))
