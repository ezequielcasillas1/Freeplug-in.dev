/**
 * Copy shop blank WebPs into public/ and write shop-enrich-slim.json from shop-enrich.json.
 * Usage: node scripts/ingest-shop-images.mjs <path-to-shop-enrich.json> <path-to-images-dir>
 */
import { copyFileSync, existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const ROOT = path.join(__dirname, '..')

const enrichPath = process.argv[2]
const imagesDir = process.argv[3]
if (!enrichPath || !imagesDir) {
  console.error('Usage: node scripts/ingest-shop-images.mjs <shop-enrich.json> <images/>')
  process.exit(1)
}

const raw = JSON.parse(readFileSync(enrichPath, 'utf8'))
const outImages = path.join(ROOT, 'public/merch/shop/blanks')
mkdirSync(outImages, { recursive: true })

function pickPrintPlaceholder(placeholders) {
  if (!Array.isArray(placeholders) || !placeholders.length) return null
  const pref = ['front', 'front_dtf', 'first', 'default']
  for (const p of pref) {
    const hit = placeholders.find((ph) => String(ph.position).toLowerCase() === p)
    if (hit) return hit
  }
  const dtg = placeholders.find((ph) => /dtg|dtf|embroidery/i.test(String(ph.decoration_method ?? '')))
  return dtg ?? placeholders[0]
}

const byKey = {}
for (const item of raw.items ?? []) {
  const key = `${item.blueprint_id}:${item.provider_id}`
  const imageFiles = (item.image_files ?? []).map((f) => {
    const src = path.join(imagesDir, f)
    const dest = path.join(outImages, f)
    if (existsSync(src)) copyFileSync(src, dest)
    return f
  })
  const variants = {}
  for (const v of item.variants ?? []) {
    const ph = pickPrintPlaceholder(v.placeholders)
    variants[String(v.id)] = {
      title: v.title ?? null,
      color: v.color ?? null,
      size: v.size ?? null,
      print:
        ph != null
          ? {
              position: ph.position,
              width: ph.width,
              height: ph.height,
            }
          : null,
    }
  }
  byKey[key] = {
    blueprintId: item.blueprint_id,
    providerId: item.provider_id,
    images: imageFiles,
    variants,
  }
}

const out = path.join(ROOT, 'src/lib/merch/shop/shop-enrich-slim.json')
writeFileSync(out, JSON.stringify({ generatedAt: new Date().toISOString(), items: byKey }, null, 0))
console.log(`Wrote ${Object.keys(byKey).length} enrich entries; images -> public/merch/shop/blanks/`)
