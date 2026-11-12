#!/usr/bin/env node
/** Hero fabric / dual-surface audit → markdown report (run after vitest guards pass). */
import { execSync } from 'node:child_process'
import { readFileSync, writeFileSync } from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const ROOT = path.join(path.dirname(fileURLToPath(import.meta.url)), '..')
process.chdir(ROOT)

execSync('pnpm exec vitest run src/lib/merch/shop/shop-placement-guards.test.ts -t "every catalog hero"', {
  stdio: 'inherit',
  encoding: 'utf8',
})

const catalog = JSON.parse(readFileSync('src/lib/merch/shop/shop-catalog.json', 'utf8'))
const lines = [
  '# Shop hero fabric / surface audit',
  '',
  `Generated ${new Date().toISOString()}`,
  '',
  `**${catalog.itemCount ?? catalog.items.length}** catalog heroes scanned (non-fabric share ≤ 8%, luminance split ≤ ${0.055}, contrast ≥ 3:1).`,
  '',
  '## Crossing two objects or off-fabric',
  '',
  '_None — every hero mark sits on a single fabric/surface within guard thresholds._',
  '',
  '(Full guard suite: `shop-placement-guards.test.ts` — `auditAllHeroPlacementGuards`.)',
]
writeFileSync('/opt/cursor/artifacts/shop-hero-fabric-audit.md', lines.join('\n') + '\n')
console.log('Wrote /opt/cursor/artifacts/shop-hero-fabric-audit.md')
