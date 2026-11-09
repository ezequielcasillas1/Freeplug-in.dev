#!/usr/bin/env node
/**
 * One-off: download Printify mockups into public/merch/shirts/ (run at build/setup, not at runtime).
 */
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), '..')
const catalogPath = path.join(root, 'src/lib/merch/shirts/shirts-catalog.json')
const outDir = path.join(root, 'public/merch/shirts')

const catalog = JSON.parse(fs.readFileSync(catalogPath, 'utf8'))
const colors = ['Black', 'Charcoal', 'Natural', 'White']

fs.mkdirSync(outDir, { recursive: true })

async function download(url, dest) {
  const res = await fetch(url)
  if (!res.ok) throw new Error(`HTTP ${res.status} ${url}`)
  const buf = Buffer.from(await res.arrayBuffer())
  fs.writeFileSync(dest, buf)
}

let count = 0
for (const product of catalog) {
  for (const color of colors) {
    for (const side of ['front', 'back']) {
      const key = `${color}-${side}`
      const url = product.mockups[key]
      if (!url) continue
      const name = `${product.slug}-${color.toLowerCase()}-${side}.jpg`
      const dest = path.join(outDir, name)
      if (fs.existsSync(dest)) {
        count++
        continue
      }
      process.stdout.write(`fetch ${name}...\n`)
      await download(url, dest)
      count++
    }
  }
}
console.log(`mockups ready (${count} files) in ${outDir}`)
