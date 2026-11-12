#!/usr/bin/env node
/** Scan every shop gallery slide for baked Printify / pre-print art. */
import { readFileSync, writeFileSync } from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { analyzeBakedMockArt, bakedSlideHeuristic } from './lib/shop-blank-baked-art.mjs'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const ROOT = path.join(__dirname, '..')
const CATALOG = path.join(ROOT, 'src/lib/merch/shop/shop-catalog.json')
const OUT_JSON = path.join(ROOT, 'src/lib/merch/shop/shop-gallery-baked-scan.json')
const ARTIFACTS = '/opt/cursor/artifacts/shop-gallery-baked-scan.md'

const catalog = JSON.parse(readFileSync(CATALOG, 'utf8'))
const findings = []

for (const item of catalog.items) {
  const gallery = item.gallery ?? []
  for (let i = 0; i < gallery.length; i++) {
    const src = gallery[i]
    const scan = await analyzeBakedMockArt(src, ROOT)
    if (scan.baked || bakedSlideHeuristic(scan, item.slug, i)) {
      findings.push({
        slug: item.slug,
        slide: i,
        src,
        share: Math.round(scan.share * 10000) / 10000,
        patchFpShare: Math.round((scan.patchFpShare ?? 0) * 10000) / 10000,
        reasons: scan.reasons,
      })
    }
  }
}

findings.sort((a, b) => a.slug.localeCompare(b.slug) || a.slide - b.slide)
writeFileSync(
  OUT_JSON,
  JSON.stringify(
    {
      generatedAt: new Date().toISOString(),
      slideCount: catalog.items.reduce((n, i) => n + (i.gallery?.length ?? 0), 0),
      bakedSlideCount: findings.length,
      findings,
    },
    null,
    2
  ) + '\n'
)

const md = [
  `# Shop blank baked-art scan (${findings.length} slides)`,
  ``,
  `Generated ${new Date().toISOString()}`,
  ``,
  ...findings.map(
    (f) =>
      `- **${f.slug}** slide ${f.slide} (\`${f.src}\`) share=${f.share} — ${f.reasons.join(', ')}`
  ),
  ``,
].join('\n')
writeFileSync(ARTIFACTS, md)
console.log(`Baked slides: ${findings.length} → ${OUT_JSON}`)
console.log(`Report → ${ARTIFACTS}`)
