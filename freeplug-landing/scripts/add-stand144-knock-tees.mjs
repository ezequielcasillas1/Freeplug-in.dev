#!/usr/bin/env node
/**
 * Add Stand With the 144,000 + Knock on Doors tees to shirts-catalog.json and download mockups.
 * Uses Printify API when PRINTIFY_API_TOKEN is set; otherwise standard Gildan 64000 variant map + images-api mockups.
 */
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const ROOT = path.join(path.dirname(fileURLToPath(import.meta.url)), '..')
const CATALOG_PATH = path.join(ROOT, 'src/lib/merch/shirts/shirts-catalog.json')
const OUT_DIR = path.join(ROOT, 'public/merch/shirts')
const SHOP_ID = '29664778'

const COLORS = ['White', 'Black', 'Charcoal', 'Natural']
const VARIANT_BY_COLOR = {
  White: 38191,
  Black: 38192,
  Charcoal: 38181,
  Natural: 63303,
}

const SIZES = ['S', 'M', 'L', 'XL', '2XL', '3XL']

/** Reference variant map shared by Gildan soft-style tees in shop 29664778 */
const STANDARD_VARIANTS = {
  'S / Charcoal': 38153,
  'S / White': 38163,
  'S / Black': 38164,
  'M / Charcoal': 38167,
  'M / White': 38177,
  'M / Black': 38178,
  'L / Charcoal': 38181,
  'L / White': 38191,
  'L / Black': 38192,
  'XL / Charcoal': 38195,
  'XL / White': 38205,
  'XL / Black': 38206,
  '2XL / Charcoal': 38209,
  '2XL / White': 38219,
  '2XL / Black': 38220,
  '3XL / Charcoal': 42109,
  '3XL / White': 42120,
  '3XL / Black': 42122,
  'S / Natural': 63293,
  'M / Natural': 63298,
  'L / Natural': 63303,
  'XL / Natural': 63308,
  '2XL / Natural': 63313,
  '3XL / Natural': 63318,
}

const NEW_PRODUCTS = [
  {
    printifyProductId: '6af5cb568f606d53210f23c1',
    slug: '36-stand-144000-crest',
    catalogTitle: 'I Stand With the 144,000 — Crest',
    fileBase: 'i-stand-with-the-144-000-tee-crest',
    backPrint: false,
  },
  {
    printifyProductId: '6af5cb7e2671251aea09ebc3',
    slug: '37-stand-144000-stencil',
    catalogTitle: 'I Stand With the 144,000 — Stencil',
    fileBase: 'i-stand-with-the-144-000-tee-stencil',
    backPrint: false,
  },
  {
    printifyProductId: '6af5cb87f779aa77dc064800',
    slug: '38-stand-144000-blend',
    catalogTitle: 'I Stand With the 144,000 — Blend',
    fileBase: 'i-stand-with-the-144-000-tee-blend',
    backPrint: false,
  },
  {
    printifyProductId: '6af5cb90a562f9679a04ce17',
    slug: '39-knock-doors-left-chest',
    catalogTitle: 'Knock on Doors — Left Chest',
    fileBase: 'knock-on-doors-tee-left-chest',
    backPrint: false,
  },
  {
    printifyProductId: '6af5cb96dda407dd0f042750',
    slug: '40-knock-doors-centered',
    catalogTitle: 'Knock on Doors — Centered',
    fileBase: 'knock-on-doors-tee-centered',
    backPrint: false,
  },
  {
    printifyProductId: '6af5cba1f61d84659e0f6db0',
    slug: '41-knock-doors-front-back',
    catalogTitle: 'Knock on Doors — Front and Back',
    fileBase: 'knock-on-doors-tee-front-and-back',
    backPrint: true,
  },
]

function slugifyFileBase(title) {
  return title
    .toLowerCase()
    .replace(/[™®]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '')
}

async function fetchPrintifyProduct(productId, token) {
  const url = `https://api.printify.com/v1/shops/${SHOP_ID}/products/${productId}.json`
  const res = await fetch(url, {
    headers: { Authorization: `Bearer ${token}`, 'User-Agent': 'FreeplugMerch/1.0' },
  })
  if (!res.ok) {
    const text = await res.text()
    throw new Error(`Printify ${productId}: HTTP ${res.status} ${text.slice(0, 200)}`)
  }
  return res.json()
}

function variantsFromPrintify(json) {
  const variants = {}
  for (const v of json.variants ?? []) {
    if (!v.is_enabled) continue
    const title = typeof v.title === 'string' ? v.title.trim() : ''
    if (title) variants[title] = v.id
  }
  return variants
}

function mockupUrl(productId, variantId, side, fileBase) {
  const camera = side === 'front' ? 'front' : 'back'
  const label = side === 'front' ? 97992 : 97993
  return `https://images-api.printify.com/mockup/${productId}/${variantId}/${label}/${fileBase}.jpg?camera_label=${camera}`
}

function buildMockups(productId, fileBase) {
  const mockups = {}
  for (const color of COLORS) {
    const variantId = VARIANT_BY_COLOR[color]
    mockups[`${color}-front`] = mockupUrl(productId, variantId, 'front', fileBase)
    mockups[`${color}-back`] = mockupUrl(productId, variantId, 'back', fileBase)
  }
  return mockups
}

function catalogEntry(meta, variants, mockups) {
  return {
    slug: meta.slug,
    title: meta.catalogTitle,
    printify_product_id: meta.printifyProductId,
    back_print: meta.backPrint,
    variants,
    mockups,
  }
}

async function download(url, dest) {
  const res = await fetch(url)
  if (!res.ok) throw new Error(`HTTP ${res.status} ${url}`)
  const buf = Buffer.from(await res.arrayBuffer())
  fs.writeFileSync(dest, buf)
}

async function downloadMockupsForEntry(entry) {
  fs.mkdirSync(OUT_DIR, { recursive: true })
  for (const color of COLORS) {
    for (const side of ['front', 'back']) {
      if (!entry.back_print && side === 'back') continue
      const key = `${color}-${side}`
      const url = entry.mockups[key]
      if (!url) continue
      const name = `${entry.slug}-${color.toLowerCase()}-${side}.jpg`
      const dest = path.join(OUT_DIR, name)
      process.stdout.write(`download ${name}\n`)
      await download(url, dest)
    }
  }
}

async function main() {
  const token = process.env.PRINTIFY_API_TOKEN?.trim()
  const catalog = JSON.parse(fs.readFileSync(CATALOG_PATH, 'utf8'))
  const existingSlugs = new Set(catalog.map((e) => e.slug))
  const newEntries = []

  for (const meta of NEW_PRODUCTS) {
    if (existingSlugs.has(meta.slug)) {
      console.log(`skip existing slug ${meta.slug}`)
      continue
    }

    let fileBase = meta.fileBase
    let variants = { ...STANDARD_VARIANTS }
    let title = meta.catalogTitle

    if (token) {
      const json = await fetchPrintifyProduct(meta.printifyProductId, token)
      title = typeof json.title === 'string' && json.title.trim() ? json.title.trim() : title
      fileBase = slugifyFileBase(title)
      const fromApi = variantsFromPrintify(json)
      if (Object.keys(fromApi).length > 0) {
        for (const size of SIZES) {
          for (const color of COLORS) {
            const key = `${size} / ${color}`
            if (fromApi[key] != null) variants[key] = fromApi[key]
          }
        }
      }
    } else {
      console.warn('PRINTIFY_API_TOKEN not set — using standard variant map and images-api mockups')
    }

    const mockups = buildMockups(meta.printifyProductId, fileBase)
    const entry = catalogEntry({ ...meta, catalogTitle: title }, variants, mockups)
    newEntries.push(entry)
    await downloadMockupsForEntry(entry)
  }

  if (newEntries.length === 0) {
    console.log('No new entries to append.')
    return
  }

  const merged = [...catalog, ...newEntries]
  fs.writeFileSync(CATALOG_PATH, `${JSON.stringify(merged, null, 2)}\n`)
  console.log(`Appended ${newEntries.length} products to ${CATALOG_PATH}`)

  const publishDoc = path.join(ROOT, 'docs/MERCH-PRINTIFY-CUSTOM-PUBLISH.md')
  const lines = [
    '# Printify custom integration — publish handshake (tees 36–41)',
    '',
    'After deploy, call **publishing_succeeded** once per product (do not run until live URLs work).',
    '',
    '```bash',
    'SHOP_ID=29664778',
    'BASE=https://freeplug-in.dev',
    '# Authorization: Bearer $PRINTIFY_API_TOKEN',
    '',
    ...NEW_PRODUCTS.map((p) => {
      return [
        `curl -sS -X POST "https://api.printify.com/v1/shops/$SHOP_ID/products/${p.printifyProductId}/publishing_succeeded.json" \\`,
        '  -H "Authorization: Bearer $PRINTIFY_API_TOKEN" \\',
        '  -H "Content-Type: application/json" \\',
        `  -d '{"external":{"id":"${p.slug}","handle":"'$BASE'/merch/t-shirts/${p.slug}"}}'`,
        '',
      ].join('\n')
    }),
    '```',
    '',
    'On failure: `POST .../publishing_failed.json` with `{"reason":"..."}`.',
    '',
  ]
  fs.mkdirSync(path.dirname(publishDoc), { recursive: true })
  fs.writeFileSync(publishDoc, lines.join('\n'))
  console.log(`Wrote ${publishDoc}`)
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})
