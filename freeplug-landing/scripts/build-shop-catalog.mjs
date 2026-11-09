/**
 * Builds shop-catalog.json and SHOP-DRAFT-PLAN.json from TOP-ITEMS.csv + catalog-us.jsonl.
 * Run: node scripts/build-shop-catalog.mjs [path-to-catalog-us.jsonl]
 */
import { createReadStream, readFileSync, writeFileSync } from 'node:fs'
import { createInterface } from 'node:readline'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const ROOT = path.join(__dirname, '..')
const CSV_PATH = path.join(ROOT, '..', 'docs/merch-research/TOP-ITEMS.csv')
const CONTRAST_PATH = path.join(ROOT, '..', 'docs/merch-research/CONTRAST_MAP.json')
const OUT_CATALOG = path.join(ROOT, 'src/lib/merch/shop/shop-catalog.json')
const OUT_PLAN = path.join(ROOT, '..', 'docs/merch-research/SHOP-DRAFT-PLAN.json')
const OUT_PRODUCTS = path.join(ROOT, 'src/lib/merch/shop/printify-products.json')

const jsonlPath = process.argv[2] || path.join(ROOT, '..', 'uploads/catalog-us.jsonl')

const contrast = JSON.parse(readFileSync(CONTRAST_PATH, 'utf8'))
const lightBlanks = new Set(contrast.light_blanks.map((s) => s.toLowerCase()))
const darkBlanks = new Set(contrast.dark_blanks.map((s) => s.toLowerCase()))

function slugify(title, blueprintId) {
  const base = title
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 48)
  return `${base}-${blueprintId}`
}

function retailCentsFromCost(costCents) {
  const dollars = costCents / 100 / 0.55
  const ceil = Math.ceil(dollars)
  return ceil * 100 - 1
}

function parseVariantTitle(title) {
  if (!title) return { color: null, size: null, raw: null }
  const parts = title.split('/').map((p) => p.trim())
  if (parts.length >= 2) {
    return { color: parts[0], size: parts[1], raw: title }
  }
  return { color: parts[0] || null, size: null, raw: title }
}

function classifyBlankColor(colorName) {
  if (!colorName) return 'light'
  const c = colorName.toLowerCase()
  for (const d of darkBlanks) {
    if (c.includes(d)) return 'dark'
  }
  for (const l of lightBlanks) {
    if (c.includes(l)) return 'light'
  }
  if (/\b(black|navy|charcoal|maroon|forest|olive|brown)\b/i.test(c)) return 'dark'
  return 'light'
}

function tabForCategory(category) {
  const c = category.toLowerCase()
  if (c.startsWith('apparel')) return 'apparel'
  if (c.startsWith('hats')) return 'hats'
  if (c.startsWith('drinkware')) return 'drinkware'
  if (c.startsWith('home')) return 'home'
  if (c.startsWith('wall')) return 'wall-art'
  if (c.startsWith('bags')) return 'bags'
  if (c.startsWith('tech')) return 'tech-desk'
  if (c.startsWith('pets')) return 'pets'
  if (c.startsWith('outdoor')) return 'outdoor'
  if (c.startsWith('kids')) return 'kids'
  if (c.startsWith('socks') || c.startsWith('jewelry') || c.startsWith('stickers')) return 'accessories'
  return 'accessories'
}

function productTypeFromCategory(category, title) {
  const t = title.toLowerCase()
  if (t.includes('hoodie')) return 'hoodie'
  if (t.includes('sweatshirt') || t.includes('crewneck')) return 'sweatshirt'
  if (t.includes('long sleeve')) return 'long-sleeve'
  if (t.includes('tank')) return 'tank'
  if (t.includes('tee') || t.includes('t-shirt')) return 'tee'
  if (t.includes('mug')) return 'mug'
  if (t.includes('poster')) return 'poster'
  if (t.includes('canvas')) return 'canvas'
  if (t.includes('sticker')) return 'sticker'
  if (t.includes('hat') || t.includes('cap') || t.includes('beanie')) return 'hat'
  if (t.includes('tote') || t.includes('bag')) return 'bag'
  return category.split(/[—–-]/).pop()?.trim().toLowerCase().replace(/\s+/g, '-') || 'other'
}

function defaultPrintArea(category) {
  const c = category.toLowerCase()
  if (c.includes('apparel') || c.includes('kids') || c.includes('socks')) {
    return { place: 'front', width: 4200, height: 4800, position: { x: 0.5, y: 0.42, scale: 0.38 } }
  }
  if (c.includes('hat')) {
    return { place: 'front', width: 1200, height: 1200, position: { x: 0.5, y: 0.5, scale: 0.55 } }
  }
  if (c.includes('mug') || c.includes('drinkware')) {
    return { place: 'wrap', width: 2400, height: 1020, position: { x: 0.5, y: 0.5, scale: 0.45 } }
  }
  if (c.includes('poster') || c.includes('wall') || c.includes('canvas')) {
    return { place: 'front', width: 3600, height: 4800, position: { x: 0.5, y: 0.5, scale: 0.5 } }
  }
  return { place: 'front', width: 3000, height: 3000, position: { x: 0.5, y: 0.5, scale: 0.42 } }
}

function parseCsv(text) {
  const lines = text.trim().split('\n')
  const header = lines[0].split(',')
  const rows = []
  for (let i = 1; i < lines.length; i++) {
    const line = lines[i]
    const cells = []
    let cur = ''
    let inQuote = false
    for (let j = 0; j < line.length; j++) {
      const ch = line[j]
      if (ch === '"') {
        inQuote = !inQuote
        continue
      }
      if (ch === ',' && !inQuote) {
        cells.push(cur)
        cur = ''
        continue
      }
      cur += ch
    }
    cells.push(cur)
    const row = {}
    header.forEach((h, idx) => {
      row[h] = cells[idx] ?? ''
    })
    rows.push(row)
  }
  return rows
}

async function indexJsonl(filePath) {
  const map = new Map()
  const rl = createInterface({ input: createReadStream(filePath), crlfDelay: Infinity })
  for await (const line of rl) {
    if (!line.trim()) continue
    const row = JSON.parse(line)
    map.set(`${row.blueprint_id}:${row.provider_id}`, row)
  }
  return map
}

function csvRows() {
  return parseCsv(readFileSync(CSV_PATH, 'utf8'))
}

const catalogIndex = await indexJsonl(jsonlPath)
const csv = csvRows()
const items = []
const planItems = []
let featuredRank = 1

for (const row of csv) {
  const blueprintId = Number(row.blueprint_id)
  const providerId = Number(row.provider_id)
  const key = `${blueprintId}:${providerId}`
  const catalogRow = catalogIndex.get(key)
  const slug = slugify(row.blueprint_title, blueprintId)
  const tab = tabForCategory(row.category)
  const productType = productTypeFromCategory(row.category, row.blueprint_title)
  const printArea = defaultPrintArea(row.category)
  const shippingFirstCents = catalogRow?.us_shipping_first_cents ?? Math.round(Number(row.us_shipping_first_usd) * 100)
  const shippingAddCents = catalogRow?.us_shipping_additional_cents ?? Math.round(Number(row.us_shipping_additional_usd) * 100)

  const inStockVariants = (catalogRow?.variants ?? []).filter((v) => v.available && v.status === 'in-stock')
  const variants = []
  const colors = new Set()
  const sizes = new Set()
  for (const v of inStockVariants) {
    const parsed = parseVariantTitle(v.title)
    if (parsed.color) colors.add(parsed.color)
    if (parsed.size) sizes.add(parsed.size)
    const blankKind = classifyBlankColor(parsed.color || '')
    const logoFile =
      blankKind === 'dark'
        ? 'public/merch/shop/freeplug-logo-light-garment.png'
        : 'public/merch/shop/freeplug-logo-dark-garment.png'
    const retailCents = retailCentsFromCost(v.cost_cents)
    variants.push({
      id: v.id,
      title: v.title,
      color: parsed.color,
      size: parsed.size,
      costCents: v.cost_cents,
      retailCents,
      blankKind,
      logoFile,
    })
  }

  const fromRetailCents =
    variants.length > 0 ? Math.min(...variants.map((v) => v.retailCents)) : Math.round(Number(row.suggested_retail_usd) * 100)

  const mockupBase = catalogRow?.blueprint_image_url || null
  const hasMockup = Boolean(mockupBase)

  items.push({
    slug,
    blueprintId,
    providerId,
    providerName: row.provider_name,
    title: row.blueprint_title,
    brand: row.brand,
    model: row.model,
    category: row.category,
    tab,
    productType,
    featuredRank,
    variantCount: Number(row.variant_count) || variants.length,
    costMinCents: Math.round(Number(row.cost_min_usd) * 100),
    costMaxCents: Math.round(Number(row.cost_max_usd) * 100),
    fromRetailCents,
    shippingFirstCents,
    shippingAdditionalCents: shippingAddCents,
    colors: [...colors].sort(),
    sizes: [...sizes].sort(),
    variants,
    imageUrl: mockupBase,
    placeholder: !hasMockup,
    printArea,
  })

  planItems.push({
    slug,
    blueprint_id: blueprintId,
    provider_id: providerId,
  provider_name: row.provider_name,
    variant_ids: variants.map((v) => v.id),
    retail_cents_by_variant: Object.fromEntries(variants.map((v) => [String(v.id), v.retailCents])),
    print_area: printArea,
    logo_by_color: Object.fromEntries(
      variants
        .filter((v) => v.color)
        .map((v) => [v.color, v.blankKind === 'dark' ? 'light' : 'dark'])
    ),
    default_logo_file:
      variants[0]?.logoFile ?? 'public/merch/shop/freeplug-logo-dark-garment.png',
  })

  featuredRank++
}

writeFileSync(OUT_CATALOG, JSON.stringify({ generatedAt: new Date().toISOString(), itemCount: items.length, items }, null, 0))
writeFileSync(OUT_PLAN, JSON.stringify({ generatedAt: new Date().toISOString(), itemCount: planItems.length, items: planItems }, null, 2))

const productMap = { bySlug: {} }
for (const item of items) {
  productMap.bySlug[item.slug] = { printifyProductId: null, blueprintId: item.blueprintId, providerId: item.providerId }
}
writeFileSync(OUT_PRODUCTS, JSON.stringify(productMap, null, 2))

console.log(`Wrote ${items.length} items to shop-catalog.json`)
console.log(`Placeholders: ${items.filter((i) => i.placeholder).length}, with blueprint image: ${items.filter((i) => !i.placeholder).length}`)
