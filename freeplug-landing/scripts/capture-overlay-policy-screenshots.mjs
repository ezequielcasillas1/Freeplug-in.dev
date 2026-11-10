#!/usr/bin/env node
/** Side-by-side merch screenshots for overlay policy PR (local dev). */
import { chromium } from 'playwright'
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), '..')
const base = process.env.BASE_URL ?? 'http://localhost:3000'
const out = process.env.ARTIFACT_DIR ?? '/opt/cursor/artifacts'

const cases = [
  {
    name: 'a-keep-beanie',
    href: '/en/shop/12-solid-cuffed-beanie-5665',
    note: 'Group A — keeps name-box (forceKeep cuff complement)',
  },
  {
    name: 'a-drop-accent-mug',
    href: '/en/shop/11oz-accent-mug-583',
    note: 'Group A — drops name-box (vibrant baked rectangle)',
  },
  {
    name: 'b-fp-circle-cap',
    href: '/en/merch/hats/fp-circle-trucker-cap',
    note: 'Group B — drops name-box',
  },
  {
    name: 'unknown-open-hand-tee',
    href: '/en/merch/t-shirts/11-init-open-hand-give',
    note: 'Unknown — drops name-box',
  },
]

fs.mkdirSync(out, { recursive: true })

const browser = await chromium.launch()
const ctx = await browser.newContext({ deviceScaleFactor: 2, viewport: { width: 1280, height: 900 } })
const page = await ctx.newPage()

const shots = []

for (const c of cases) {
  for (const previewOff of [true, false]) {
    const qs = previewOff ? '?preview=0' : ''
    await page.goto(`${base}${c.href}${qs}`, { waitUntil: 'networkidle', timeout: 120_000 })
    await page.waitForTimeout(400)
    const tag = previewOff ? 'before' : 'after'
    const file = `overlay-policy-${tag}-${c.name}.png`
  await page.screenshot({ path: path.join(out, file), fullPage: false })
    shots.push({ file, note: c.note, previewOff })
    console.log('captured', file)
  }
}

// Combined contact sheet via simple HTML
const html = `<!DOCTYPE html><html><body style="font-family:system-ui;background:#111;color:#eee;padding:16px">
<h1>Overlay policy — preview on vs off</h1>
<div style="display:grid;grid-template-columns:repeat(2,1fr);gap:12px">
${cases
  .map(
    (c) => `<p style="grid-column:1/-1;font-weight:600;margin:12px 0 4px">${c.note}</p>
<img src="overlay-policy-before-${c.name}.png" style="width:100%;border:1px solid #333"/>
<img src="overlay-policy-after-${c.name}.png" style="width:100%;border:1px solid #333"/>`
  )
  .join('')}
</div></body></html>`
fs.writeFileSync(path.join(out, 'overlay-policy-contact.html'), html)

await ctx.close()
await browser.close()
console.log('done', out)
