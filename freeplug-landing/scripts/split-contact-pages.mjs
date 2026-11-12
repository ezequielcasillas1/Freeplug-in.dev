#!/usr/bin/env node
/**
 * Split 5-col contact sheets into left/right halves (min width 1600px each).
 * Input: /opt/cursor/artifacts/shop-overlay-contact-pdp-page{N}.png
 * Output: round11-contact-pdp-page{N}-left.png, -right.png
 */
import { existsSync } from 'node:fs'
import path from 'node:path'
import sharp from 'sharp'

const ARTIFACTS = '/opt/cursor/artifacts'
const MIN_HALF_W = 1600

for (let p = 1; p <= 5; p++) {
  const src = path.join(ARTIFACTS, `shop-overlay-contact-pdp-page${p}.png`)
  if (!existsSync(src)) {
    console.warn(`Missing ${src}`)
    continue
  }
  const meta = await sharp(src).metadata()
  const w = meta.width ?? 0
  const h = meta.height ?? 0
  const half = Math.ceil(w / 2)
  const scale = half < MIN_HALF_W ? MIN_HALF_W / half : 1
  const outHalf = Math.round(half * scale)
  const outH = Math.round(h * scale)

  for (const [side, left, width] of [
    ['left', 0, half],
    ['right', half, w - half],
  ]) {
    const buf = await sharp(src)
      .extract({ left, top: 0, width, height: h })
      .resize(outHalf, outH, { kernel: sharp.kernel.lanczos3 })
      .png()
      .toBuffer()
    await sharp(buf).toFile(path.join(ARTIFACTS, `round11-contact-pdp-page${p}-${side}.png`))
  }
  console.log(`Page ${p}: split ${w}×${h} → halves ~${outHalf}px wide`)
}
