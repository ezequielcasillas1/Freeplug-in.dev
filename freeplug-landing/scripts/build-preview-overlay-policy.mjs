#!/usr/bin/env node
/**
 * Builds preview-overlay-policy.json from classification.csv (Group A/B/Unknown).
 * Group A may still suppress overlay when vibrant baked art would double (Cheke Nov 10).
 * No Printify API calls.
 */
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), '..')
const src = path.join(root, 'src/lib/merch/preview')
const csvPath =
  process.env.CLASSIFICATION_CSV ?? path.join(src, 'classification.snapshot.csv')

const shopPrintify = JSON.parse(
  fs.readFileSync(path.join(root, 'src/lib/merch/shop/printify-products.json'), 'utf8')
)
const shopCatalog = JSON.parse(
  fs.readFileSync(path.join(root, 'src/lib/merch/shop/shop-catalog.json'), 'utf8')
)
const shirtsCatalog = JSON.parse(
  fs.readFileSync(path.join(root, 'src/lib/merch/shirts/shirts-catalog.json'), 'utf8')
)
const collections = JSON.parse(
  fs.readFileSync(path.join(root, 'src/lib/merch/collections/collections-catalog.json'), 'utf8')
)

const shirtList = Array.isArray(shirtsCatalog) ? shirtsCatalog : shirtsCatalog.products ?? []
const shirtBySlug = Object.fromEntries(shirtList.map((p) => [p.slug, p.printify_product_id]))
const collectionBySlug = Object.fromEntries(collections.map((p) => [p.slug, p.printify_product_id]))

function slugFromSiteHref(href) {
  if (!href) return null
  if (href.startsWith('/shop/')) return href.slice('/shop/'.length)
  if (href.startsWith('/merch/t-shirts/')) return href.slice('/merch/t-shirts/'.length)
  const m = href.match(/^\/merch\/[^/]+\/(.+)$/)
  return m ? m[1] : null
}

function resolvePrintifyFromHref(href) {
  const slug = slugFromSiteHref(href)
  if (!slug) return null
  if (href.startsWith('/shop/')) {
    return shopPrintify.bySlug[slug]?.printifyProductId?.trim() ?? null
  }
  if (href.startsWith('/merch/t-shirts/')) {
    return shirtBySlug[slug] ?? null
  }
  return collectionBySlug[slug] ?? null
}

/** Cheke-approved keeps where the live name variant complements art (not clutter). */
const FORCE_KEEP = new Map([
  [
    '6af1827130966f8b83011b71',
    '12 Solid Cuffed Beanie: cuff badge placement; name variant complements red embroidery without covering the mark.',
  ],
])

const STANDARD_RECT_LOGO = /6af17fa0477c451124346b06|6af17fa01cc9b769e9d23237/

/** Vibrant center-print surfaces where a second name-box stacks on the baked rectangle. */
const VIBRANT_SITE_TYPES = new Set([
  'mug',
  'drinkware',
  'poster',
  'wall-art',
  'canvas',
  't-shirt',
  'sweatshirt',
  'hoodie',
  'hat',
  'hats',
  'kids-&-baby',
  'bag',
  'bags',
  'pets',
  'home-&-decor',
  'outdoor-&-seasonal',
  'jewelry-&-pins',
])

function parseCsv(text) {
  const lines = []
  let cur = ''
  let row = []
  let inQuotes = false
  for (let i = 0; i < text.length; i++) {
    const ch = text[i]
    if (ch === '"') {
      if (inQuotes && text[i + 1] === '"') {
        cur += '"'
        i++
      } else {
        inQuotes = !inQuotes
      }
      continue
    }
    if (!inQuotes && ch === ',') {
      row.push(cur)
      cur = ''
      continue
    }
    if (!inQuotes && ch === '\n') {
      row.push(cur)
      lines.push(row)
      row = []
      cur = ''
      continue
    }
    cur += ch
  }
  if (cur.length || row.length) {
    row.push(cur)
    lines.push(row)
  }
  return lines
}

function vibrantOverlapSuppress(siteType, evidence) {
  if (!siteType || siteType === 'unmapped') return { suppress: true, reason: 'Not on storefront mapping.' }
  if (VIBRANT_SITE_TYPES.has(siteType) && STANDARD_RECT_LOGO.test(evidence)) {
    return {
      suppress: true,
      reason:
        'Baked vibrant Freeplug script rectangle on main print; extra site name-box duplicates artwork (Cheke Nov 10).',
    }
  }
  if (VIBRANT_SITE_TYPES.has(siteType)) {
    return {
      suppress: true,
      reason: 'Colorful / dominant placement print; site name-box would crowd the mockup.',
    }
  }
  return { suppress: true, reason: 'Default clean preview: no site name-box unless explicitly approved.' }
}

const csvRaw = fs.existsSync(csvPath)
  ? fs.readFileSync(csvPath, 'utf8')
  : fs.readFileSync(path.join(root, 'src/lib/merch/preview/classification.snapshot.csv'), 'utf8')

const rows = parseCsv(csvRaw)
const header = rows[0]
const idx = Object.fromEntries(header.map((h, i) => [h, i]))
const byPrintifyId = {}
let groupA = 0
let groupB = 0
let groupUnknown = 0

for (const row of rows.slice(1)) {
  if (!row.length || row.length < 3) continue
  const id = row[idx.id]?.trim()
  const group = row[idx.group]?.trim()
  const title = row[idx.title]?.trim()
  const siteHref = row[idx.site_href]?.trim()
  const siteType = row[idx.site_product_type]?.trim()
  const evidence = row[idx.evidence]?.trim() ?? ''
  if (!id) continue
  if (group === 'A') groupA++
  else if (group === 'B') groupB++
  else if (group === 'Unknown') groupUnknown++

  const forceKeep = FORCE_KEEP.get(id)
  let showOverlay = false
  let rationale = ''

  if (group !== 'A') {
    showOverlay = false
    rationale =
      group === 'B'
        ? 'FP-mark / non-rectangle art (Group B); site name-box removed.'
        : 'Slogan or mixed art (Unknown); site name-box removed.'
  } else if (forceKeep) {
    showOverlay = true
    rationale = forceKeep
  } else {
    const { suppress, reason } = vibrantOverlapSuppress(siteType, evidence)
    showOverlay = !suppress
    rationale = reason
  }

  byPrintifyId[id] = {
    group,
    title,
    siteHref: siteHref || null,
    siteProductType: siteType || null,
    showPreviewWordmarkOverlay: showOverlay,
    rationale,
  }
}

// Ensure every mapped storefront slug resolves to the same decision via printify id
const siteCatalogKeys = {}
for (const item of shopCatalog.items) {
  const pid = shopPrintify.bySlug[item.slug]?.printifyProductId
  if (!pid) continue
  siteCatalogKeys[`shop/${item.slug}`] = pid
}
for (const p of shirtList) {
  siteCatalogKeys[`tshirts/${p.slug}`] = p.printify_product_id
}
for (const p of collections) {
  const href = `/merch/${p.collection}/${p.slug}`
  siteCatalogKeys[`${p.collection}/${p.slug}`] = p.printify_product_id
  siteCatalogKeys[`merch/${p.collection}/${p.slug}`] = p.printify_product_id
}

let siteKeep = 0
let siteDrop = 0
for (const [key, pid] of Object.entries(siteCatalogKeys)) {
  const entry = byPrintifyId[pid]
  if (!entry) {
    byPrintifyId[pid] = {
      group: 'unlisted',
      title: key,
      siteHref: null,
      siteProductType: null,
      showPreviewWordmarkOverlay: false,
      rationale: 'Printify product not in classification snapshot; default no site overlay.',
    }
    siteDrop++
    continue
  }
  if (entry.showPreviewWordmarkOverlay) siteKeep++
  else siteDrop++
}

const out = {
  schemaVersion: 2,
  generatedAt: new Date().toISOString(),
  source: path.basename(csvPath),
  counts: {
    printifyGroupA: groupA,
    printifyGroupB: groupB,
    printifyUnknown: groupUnknown,
    storefrontMapped: Object.keys(siteCatalogKeys).length,
    storefrontKeepOverlay: siteKeep,
    storefrontDropOverlay: siteDrop,
  },
  rules: {
    cohort: 'Only Printify Group A may show a site name-box.',
    vibrantOverlap:
      'Within Group A, suppress when the baked print is a vibrant Freeplug rectangle or dominant color art unless forceKeep is set.',
    defaultOff: 'Group B, Unknown, and unmapped catalog IDs never show the overlay.',
  },
  byPrintifyProductId: byPrintifyId,
}

fs.mkdirSync(src, { recursive: true })
const outPath = path.join(src, 'preview-overlay-policy.json')
fs.writeFileSync(outPath, JSON.stringify(out, null, 2) + '\n')
console.log('Wrote', outPath)
console.log(JSON.stringify(out.counts, null, 2))
