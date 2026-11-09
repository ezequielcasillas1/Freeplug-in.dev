#!/usr/bin/env node
/**
 * Rebuild Giving Verses web preview images from the bot handoff folder.
 *
 * Composites *-light-garment / *-dark-garment PNGs onto long-sleeve blank photos
 * (not Milo contact-sheet mockups). Does not commit 4500×5400 masters.
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
const LIGHT_BLANK_SRC = path.join(ROOT, 'public/merch/apparel/good-measure-longsleeve.jpg')

const MAX_EDGE = 1200
/** Chest print placement on the long-sleeve product photo (same blank as good-measure-longsleeve). */
const ART_WIDTH_FRAC = 0.42
const ART_TOP_FRAC = 0.22

async function loadBlankBuffers() {
  const light = await sharp(LIGHT_BLANK_SRC).toBuffer()
  const lightMeta = await sharp(light).metadata()
  const dark = await sharp(light)
    .modulate({ brightness: 0.55, saturation: 0.35 })
    .linear(0.9, -40)
    .toBuffer()
  return { light, dark, lightMeta }
}

async function compositeOnBlank(blankBuf, blankMeta, artPath, destWebp) {
  const artBuf = await sharp(artPath)
    .resize({ width: Math.round(blankMeta.width * ART_WIDTH_FRAC) })
    .toBuffer()
  const artMeta = await sharp(artBuf).metadata()
  const left = Math.round((blankMeta.width - artMeta.width) / 2)
  const top = Math.round(blankMeta.height * ART_TOP_FRAC)
  let pipeline = sharp(blankBuf).composite([{ input: artBuf, left, top }])
  if (blankMeta.width > MAX_EDGE || blankMeta.height > MAX_EDGE) {
    pipeline = pipeline.resize({ width: MAX_EDGE, height: MAX_EDGE, fit: 'inside', withoutEnlargement: true })
  }
  await pipeline.webp({ quality: 82 }).toFile(destWebp)
}

async function main() {
  const manifestRaw = await fs.readFile(path.join(HANDOFF, 'manifest.json'), 'utf8')
  const manifest = JSON.parse(manifestRaw)
  await fs.mkdir(OUT_IMG, { recursive: true })

  const { light, dark, lightMeta } = await loadBlankBuffers()
  await fs.writeFile(
    path.join(OUT_IMG, 'blank-light.webp'),
    await sharp(light).webp({ quality: 82 }).toBuffer()
  )
  await fs.writeFile(path.join(OUT_IMG, 'blank-dark.webp'), await sharp(dark).webp({ quality: 82 }).toBuffer())

  const verses = []
  for (const entry of manifest.entries) {
    const folder = path.join(HANDOFF, entry.slug)
    const lightArt = path.join(folder, `${entry.slug}-light-garment.png`)
    const darkArt = path.join(folder, `${entry.slug}-dark-garment.png`)
    const lightOut = path.join(OUT_IMG, `${entry.slug}-on-light.webp`)
    const darkOut = path.join(OUT_IMG, `${entry.slug}-on-dark.webp`)
    await compositeOnBlank(light, lightMeta, lightArt, lightOut)
    await compositeOnBlank(dark, lightMeta, darkArt, darkOut)

    verses.push({
      id: entry.slug,
      number: entry.number,
      book: entry.book,
      ref: entry.ref,
      phrase: entry.phrase,
      phrase_note: entry.phrase_note ?? null,
    })
  }

  await fs.copyFile(
    path.join(OUT_IMG, `${manifest.entries[0].slug}-on-light.webp`),
    path.join(ROOT, 'public/merch/apparel/giving-verses-tee.webp')
  )

  const catalog = { generatedAt: new Date().toISOString(), handoff: HANDOFF, verses }
  await fs.writeFile(OUT_JSON, `${JSON.stringify(catalog, null, 2)}\n`)
  console.log(`Giving verses: ${verses.length} × (light+dark) previews → ${OUT_IMG}`)
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})
