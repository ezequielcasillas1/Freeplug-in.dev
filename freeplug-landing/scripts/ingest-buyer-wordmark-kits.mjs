#!/usr/bin/env node
/**
 * Unpack buyer wordmark kits into public/merch/buyer-wordmark-art/.
 * Kit file names: {brand}-dark.png | {brand}-light.png
 *   -dark  = dark ink  → garment on-light (light blanks)
 *   -light = light ink → garment on-dark  (dark blanks)
 */
import { existsSync, mkdirSync, readFileSync, writeFileSync, rmSync } from 'node:fs'
import { basename, dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { execFileSync } from 'node:child_process'

const __dirname = dirname(fileURLToPath(import.meta.url))
const ROOT = join(__dirname, '..')
const INCOMING = join(ROOT, 'wordmark-kits', 'incoming')
const OUT = join(ROOT, 'public', 'merch', 'buyer-wordmark-art')
const MANIFEST_PATH = join(ROOT, 'src/lib/merch/preview/buyer-wordmark-art-manifest.json')

const BRANDS = ['fplgn', 'freeplug-dev', 'freeplug-in-dev', 'freeplug-in']

const LABEL = {
  'freeplug-dev': 'Freeplug.dev',
  fplgn: 'FPLGN',
  'freeplug-in-dev': 'Freeplug-in.dev',
  'freeplug-in': 'Freeplug.in',
}

/** Chest / placement crop preference */
const ASPECT_FOLDERS = ['bar', '']

const KITS = [
  {
    zip: 'kit-cursive',
    roots: [
      { dir: 'wordmark-variants', style: 'cursive' },
      { dir: 'wordmark-variants-plate', style: 'cursive-plate' },
    ],
  },
  {
    zip: 'kit-pop',
    roots: [{ dir: 'wordmark-variants-pop', style: 'pop-v2' }],
  },
  {
    zip: 'kit-popplate',
    roots: [{ dir: 'wordmark-variants-pop-plate', style: 'pop-plate-v2' }],
  },
]

function unzip(zipPath, destDir) {
  mkdirSync(destDir, { recursive: true })
  execFileSync('unzip', ['-oq', zipPath, '-d', destDir], { stdio: 'inherit' })
}

function kitInkToGarmentSuffix(kitInk) {
  if (kitInk === 'dark') return 'on-light'
  if (kitInk === 'light') return 'on-dark'
  throw new Error(`unknown kit ink: ${kitInk}`)
}

function resolveSource(baseRoot, brand, kitInk) {
  const file = `${brand}-${kitInk}.png`
  for (const aspect of ASPECT_FOLDERS) {
    const p = aspect ? join(baseRoot, aspect, file) : join(baseRoot, file)
    if (existsSync(p)) return p
  }
  return null
}

function main() {
  rmSync(OUT, { recursive: true, force: true })
  mkdirSync(OUT, { recursive: true })
  const mappings = []
  const tmpBase = join(ROOT, 'wordmark-kits', '.tmp')

  for (const kit of KITS) {
    const zipPath = join(INCOMING, `${kit.zip}.zip`)
    if (!existsSync(zipPath)) {
      console.error('Missing', zipPath)
      process.exitCode = 1
      continue
    }
    const tmp = join(tmpBase, kit.zip)
    rmSync(tmp, { recursive: true, force: true })
    unzip(zipPath, tmp)

    for (const { dir, style } of kit.roots) {
      const variantRoot = join(tmp, dir)
      if (!existsSync(variantRoot)) {
        console.error('Missing variant root', variantRoot)
        process.exitCode = 1
        continue
      }
      const outStyle = join(OUT, style)
      mkdirSync(outStyle, { recursive: true })

      for (const brand of BRANDS) {
        for (const kitInk of ['dark', 'light']) {
          const src = resolveSource(variantRoot, brand, kitInk)
          if (!src) {
            console.warn('No source', style, brand, kitInk)
            process.exitCode = 1
            continue
          }
          const garmentInk = kitInkToGarmentSuffix(kitInk)
          const destName = `${LABEL[brand]}-${garmentInk}.png`
          const dest = join(outStyle, destName)
          writeFileSync(dest, readFileSync(src))
          mappings.push({
            style,
            brand,
            kitInk,
            garmentInk,
            publicPath: `/merch/buyer-wordmark-art/${style}/${destName}`,
            sourceKit: kit.zip,
            sourceDir: dir,
            sourceFile: basename(src),
          })
        }
      }
    }
  }

  writeFileSync(MANIFEST_PATH, JSON.stringify({ generatedAt: new Date().toISOString(), mappings }, null, 2))
  console.log(`Installed ${mappings.length} PNGs`)
  if (mappings.length !== 32) {
    console.error('Expected 32 PNGs, got', mappings.length)
    process.exitCode = 1
  }
}

main()
