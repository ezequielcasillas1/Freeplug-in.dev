#!/usr/bin/env node
/**
 * Unpack kit-cursive, kit-pop, kit-popplate into public/merch/buyer-wordmark-art/.
 * Expected incoming: wordmark-kits/incoming/kit-{cursive|pop|popplate}.zip
 */
import { existsSync, mkdirSync, readFileSync, writeFileSync, readdirSync } from 'node:fs'
import { basename, dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { execFileSync } from 'node:child_process'

const __dirname = dirname(fileURLToPath(import.meta.url))
const ROOT = join(__dirname, '..')
const INCOMING = join(ROOT, 'wordmark-kits', 'incoming')
const OUT = join(ROOT, 'public', 'merch', 'buyer-wordmark-art')
const MANIFEST_PATH = join(ROOT, 'src/lib/merch/preview/buyer-wordmark-art-manifest.json')

const LABEL = {
  'freeplug-dev': 'Freeplug.dev',
  fplgn: 'FPLGN',
  'freeplug-in-dev': 'Freeplug-in.dev',
  'freeplug-in': 'Freeplug.in',
}

const KITS = [
  { file: 'kit-cursive', styles: [{ key: 'cursive', plate: false }, { key: 'cursive-plate', plate: true }] },
  { file: 'kit-pop', styles: [{ key: 'pop-v2', plate: false }] },
  { file: 'kit-popplate', styles: [{ key: 'pop-plate-v2', plate: true }] },
]

function unzip(zipPath, destDir) {
  mkdirSync(destDir, { recursive: true })
  execFileSync('unzip', ['-oq', zipPath, '-d', destDir], { stdio: 'inherit' })
}

function walkPng(dir, acc = []) {
  for (const ent of readdirSync(dir, { withFileTypes: true })) {
    const p = join(dir, ent.name)
    if (ent.isDirectory()) walkPng(p, acc)
    else if (/\.png$/i.test(ent.name)) acc.push(p)
  }
  return acc
}

function matchBrand(lower) {
  if (lower.includes('freeplug-in.dev') || lower.includes('freeplug-in-dev')) return 'freeplug-in-dev'
  if (lower.includes('freeplug.in') || (lower.includes('freeplug-in') && !lower.includes('.dev')))
    return 'freeplug-in'
  if (lower.includes('freeplug.dev') || (lower.includes('freeplug') && lower.includes('.dev')))
    return 'freeplug-dev'
  if (lower.includes('fplgn')) return 'fplgn'
  return null
}

function matchInk(lower) {
  if (/on-dark|dark-garment|dark garment|for-dark|light-on|light on dark|white-on-dark/i.test(lower))
    return 'on-dark'
  if (/on-light|light-garment|light garment|for-light|dark-on|dark on light|black-on-light/i.test(lower))
    return 'on-light'
  if (/\bdark\b/.test(lower) && !/\blight\b/.test(lower)) return 'on-dark'
  if (/\blight\b/.test(lower)) return 'on-light'
  return null
}

function hasPlate(lower) {
  return /plate/.test(lower)
}

function main() {
  mkdirSync(OUT, { recursive: true })
  const mappings = []

  for (const kit of KITS) {
    const zipPath = join(INCOMING, `${kit.file}.zip`)
    if (!existsSync(zipPath)) {
      console.warn('Missing', zipPath)
      continue
    }
    const tmp = join(ROOT, 'wordmark-kits', '.tmp', kit.file)
    unzip(zipPath, tmp)
    for (const src of walkPng(tmp)) {
      const lower = basename(src).toLowerCase()
      const brand = matchBrand(lower)
      const ink = matchInk(lower)
      if (!brand || !ink) continue
      const plate = hasPlate(lower)
      const styleDef = kit.styles.find((s) => s.plate === plate) ?? kit.styles[0]
      if (!styleDef) continue
      if (plate && !kit.styles.some((s) => s.plate)) continue
      if (!plate && kit.styles.length === 1 && kit.styles[0].plate) continue

      const style = styleDef.key
      const folder = join(OUT, style)
      mkdirSync(folder, { recursive: true })
      const fileName = `${LABEL[brand]}-${ink}.png`
      const dest = join(folder, fileName)
      writeFileSync(dest, readFileSync(src))
      mappings.push({
        style,
        brand,
        ink,
        publicPath: `/merch/buyer-wordmark-art/${style}/${fileName}`,
        sourceKit: kit.file,
        sourceFile: basename(src),
      })
    }
  }

  writeFileSync(MANIFEST_PATH, JSON.stringify({ generatedAt: new Date().toISOString(), mappings }, null, 2))
  console.log(`Installed ${mappings.length} PNGs → ${OUT}`)
  if (mappings.length < 32) {
    console.warn('Expected 32 PNGs (4×4×2); got', mappings.length)
    process.exitCode = 1
  }
}

main()
