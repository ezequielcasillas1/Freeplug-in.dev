#!/usr/bin/env node
/**
 * Build per-page contact sheet checklist + refresh shop-no-clean-mockup.json
 */
import { readFileSync, writeFileSync } from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { analyzeBakedMockArt, bakedSlideHeuristic } from './lib/shop-blank-baked-art.mjs'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const ROOT = path.join(__dirname, '..')
const ARTIFACTS = '/opt/cursor/artifacts'
const PER_PAGE = 40
const catalog = JSON.parse(readFileSync(path.join(ROOT, 'src/lib/merch/shop/shop-catalog.json'), 'utf8'))
const placements = JSON.parse(readFileSync(path.join(ROOT, 'src/lib/merch/shop/shop-gallery-placements.json'), 'utf8'))

const OWNER_NO_MARK = [
  'square-stickers-384',
  'posicharge-competitor-short-4127',
  '12-solid-cuffed-beanie-5665',
  'snapback-trucker-cap-1446',
]

function heroGalleryIndex(item) {
  const slides = placements.bySlug[item.slug]?.slides ?? []
  const fromGrid = item.gallery?.indexOf(item.gridImage)
  if (fromGrid != null && fromGrid >= 0 && slides[fromGrid] && !slides[fromGrid].hide) return fromGrid
  for (let i = 0; i < item.gallery.length; i++) {
    if (slides[i] && !slides[i].hide) return i
  }
  return 0
}

async function slideQuality(src, slug, slideIndex) {
  const scan = await analyzeBakedMockArt(src, ROOT)
  const baked = scan.baked || bakedSlideHeuristic(scan, slug, slideIndex)
  return { baked, text: scan.textBandShare ?? 0 }
}

const noClean = []
const lines = ['# Shop contact page audit', '', `Generated: ${new Date().toISOString()}`, '']

for (let p = 0; p * PER_PAGE < catalog.items.length; p++) {
  const chunk = catalog.items.slice(p * PER_PAGE, (p + 1) * PER_PAGE)
  const pageNum = p + 1
  lines.push(`## Page ${pageNum} (${chunk.length} tiles)`)
  lines.push('')
  lines.push('| OK | Slug | hero slide | baked hero | text band | mark px | notes |')
  lines.push('|---:|---|---:|:---:|---:|---:|---|')
  for (const item of chunk) {
    const heroSlide = heroGalleryIndex(item)
    const src = item.gallery[heroSlide]
    const quality = src ? await slideQuality(src, item.slug, heroSlide) : { baked: true, text: 1 }
    const pslide = placements.bySlug[item.slug]?.slides?.[heroSlide]
    const markPx = pslide?.width ? pslide.width * 240 : 0
    const slideScores = await Promise.all(
      (item.gallery ?? []).map((s, i) => slideQuality(s, item.slug, i))
    )
    const anyClean = slideScores.some((q) => !q.baked)
    if (!anyClean) noClean.push(item.slug)
    const notes = []
    if (!anyClean) notes.push('NO CLEAN MOCKUP')
    if (OWNER_NO_MARK.includes(item.slug)) notes.push('owner: weak/no grid mark')
    if (quality.baked) notes.push('baked on hero')
    if (markPx > 0 && markPx < 40) notes.push('mark narrow')
    const ok = !quality.baked && markPx >= 40 && !OWNER_NO_MARK.includes(item.slug)
    lines.push(
      `| ${ok ? '✓' : '·'} | ${item.slug} | ${heroSlide} | ${quality.baked ? 'yes' : 'no'} | ${quality.text.toFixed(2)} | ${markPx.toFixed(0)} | ${notes.join('; ') || '—'} |`
    )
  }
  lines.push('')
}

const noCleanPath = path.join(ROOT, 'src/lib/merch/shop/shop-no-clean-mockup.json')
const noCleanDoc = {
  description:
    'Shop items with no gallery slide free of Printify baked placeholder art (owner may hide or replace assets).',
  generatedAt: new Date().toISOString(),
  slugs: [...new Set(noClean)].sort(),
  ownerNoVisibleMark: OWNER_NO_MARK,
}
writeFileSync(noCleanPath, JSON.stringify(noCleanDoc, null, 2) + '\n')

lines.push('## No clean mockup (every slide baked)')
lines.push('')
for (const slug of noCleanDoc.slugs) lines.push(`- ${slug}`)
lines.push('')
lines.push('## Owner: no visible mark at grid size (still listed in grid)')
lines.push('')
for (const slug of OWNER_NO_MARK) lines.push(`- ${slug}`)

writeFileSync(path.join(ARTIFACTS, 'shop-contact-page-audit.md'), lines.join('\n') + '\n')
console.log(`Wrote ${ARTIFACTS}/shop-contact-page-audit.md (${noCleanDoc.slugs.length} no-clean)`)
