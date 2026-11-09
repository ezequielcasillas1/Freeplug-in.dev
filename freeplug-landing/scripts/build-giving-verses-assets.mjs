#!/usr/bin/env node
/**
 * Rebuild Giving Verses web assets from the bot handoff folder.
 *
 * Source (override with GIVING_VERSES_HANDOFF):
 *   /cursor/stores/bot/freeplug-handoff/giving-verses/
 *   - manifest.json (verse text + slugs)
 *   - {slug}/mockup.png per design (same filenames when art is refreshed)
 *
 * Outputs (safe to commit; no 4500×5400 masters):
 *   public/merch/apparel/giving-verses/{slug}-mockup.webp (~1200px max)
 *   public/merch/apparel/giving-verses-tee.webp (grid card; default #01)
 *   src/lib/merch/collections/giving-verses-catalog.json
 *
 * Run: npm run merch:rebuild-giving-verses
 */
import fs from 'node:fs/promises'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import sharp from 'sharp'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const ROOT = path.resolve(__dirname, '..')
const HANDOFF = process.env.GIVING_VERSES_HANDOFF ?? '/cursor/stores/bot/freeplug-handoff/giving-verses'
const OUT_IMG = path.join(ROOT, 'public/merch/apparel/giving-verses')
const OUT_JSON = path.join(ROOT, 'src/lib/merch/collections/giving-verses-catalog.json')

const MAX_EDGE = 1200

async function toWebp(src, dest) {
  await sharp(src)
    .resize({ width: MAX_EDGE, height: MAX_EDGE, fit: 'inside', withoutEnlargement: true })
    .webp({ quality: 82 })
    .toFile(dest)
}

async function main() {
  const manifestRaw = await fs.readFile(path.join(HANDOFF, 'manifest.json'), 'utf8')
  const manifest = JSON.parse(manifestRaw)
  await fs.mkdir(OUT_IMG, { recursive: true })

  const verses = []
  for (const entry of manifest.entries) {
    const mockupSrc = path.join(HANDOFF, entry.slug, 'mockup.png')
    const webName = `${entry.slug}-mockup.webp`
    await toWebp(mockupSrc, path.join(OUT_IMG, webName))

    verses.push({
      id: entry.slug,
      number: entry.number,
      book: entry.book,
      ref: entry.ref,
      phrase: entry.phrase,
      phrase_note: entry.phrase_note ?? null,
    })
  }

  await toWebp(
    path.join(HANDOFF, '01-proverbs-19-17/mockup.png'),
    path.join(ROOT, 'public/merch/apparel/giving-verses-tee.webp')
  )

  const catalog = { generatedAt: new Date().toISOString(), handoff: HANDOFF, verses }
  await fs.writeFile(OUT_JSON, `${JSON.stringify(catalog, null, 2)}\n`)
  console.log(`Giving verses: ${verses.length} mockups → ${OUT_IMG}`)
  console.log(`Catalog JSON → ${OUT_JSON}`)
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})
