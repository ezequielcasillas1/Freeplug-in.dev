#!/usr/bin/env node
/** Smoke: shop index EN/ES + Cheke PDP slugs return 200. */
const base = process.env.BASE_URL ?? 'http://127.0.0.1:3013'
const SLUGS = [
  'cotton-canvas-tote-bag-1313',
  'canvas-tote-bag-5-color-straps-507',
  'zippered-canvas-tote-1990',
  'tote-bag-aop-1389',
  'action-snapback-cap-5284',
  'dad-hat-with-leather-patch-rectangle-1221',
  'snapback-trucker-cap-1743',
  'mid-profile-baseball-cap-with-leather-patch-rect-2707',
  'classic-cuffed-beanie-embroidery-1691',
]
const paths = ['/shop', '/es/shop', ...SLUGS.map((s) => `/shop/${s}`)]
let failed = []
for (const p of paths) {
  const res = await fetch(`${base}${p}`)
  if (res.status !== 200) failed.push({ p, status: res.status })
}
if (failed.length) {
  console.error(JSON.stringify({ failed }, null, 2))
  process.exit(1)
}
console.log(JSON.stringify({ ok: paths.length, base }, null, 2))
