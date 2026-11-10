#!/usr/bin/env node
import { chromium } from 'playwright'
import path from 'node:path'

const base = process.env.BASE_URL ?? 'http://localhost:3000'
const out = process.env.ARTIFACT_DIR ?? '/opt/cursor/artifacts'

const pages = [
  { path: '/merch/all', name: 'filter-all-en', filterQuery: '' },
  { path: '/merch/all', name: 'filter-all-en-applied', filterQuery: 'supreme=1&name=freeplug&wstyle=box' },
  { path: '/es/merch/all', name: 'filter-all-es', filterQuery: '' },
  { path: '/es/merch/all', name: 'filter-all-es-applied', filterQuery: 'supreme=1&wstyle=script' },
  { path: '/merch/t-shirts', name: 'filter-tshirts-en', filterQuery: '' },
  { path: '/es/merch/t-shirts', name: 'filter-tshirts-es', filterQuery: 'supreme=1' },
  { path: '/shop', name: 'filter-shop-en', filterQuery: 'wstyle=stamp' },
  { path: '/es/shop', name: 'filter-shop-es', filterQuery: 'wstyle=stamp' },
]

async function openFiltersMobile(page) {
  const btn = page.getByRole('button', { name: /filters|filtros/i }).first()
  if (await btn.isVisible()) await btn.click()
}

const browser = await chromium.launch()
for (const width of [390, 1280]) {
  const page = await browser.newPage({ viewport: { width, height: width === 390 ? 900 : 1000 } })
  for (const spec of pages) {
    const qs = spec.filterQuery ? `?${spec.filterQuery}` : ''
    await page.goto(`${base}${spec.path}${qs}`, { waitUntil: 'networkidle', timeout: 120_000 })
    if (width === 390) await openFiltersMobile(page)
    else if (spec.filterQuery) {
      await openFiltersMobile(page).catch(() => undefined)
    }
    await page.waitForTimeout(600)
    await page.screenshot({
      path: path.join(out, `${spec.name}-${width}px.png`),
      fullPage: spec.filterQuery === '',
    })
    console.log('wrote', `${spec.name}-${width}px.png`)
  }
  await page.close()
}
await browser.close()
