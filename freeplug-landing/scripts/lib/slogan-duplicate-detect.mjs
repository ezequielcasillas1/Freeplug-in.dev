/**
 * Detect repeated slogan text bands in baked mockup crops (no OCR dependency).
 * Fails when two separated horizontal text bands appear in the slogan strip region.
 */
import sharp from 'sharp'

export async function detectDuplicateSloganBands(imagePath, placement) {
  const { data, info } = await sharp(imagePath)
    .ensureAlpha()
    .raw()
    .toBuffer({ resolveWithObject: true })
  const { width, height } = info
  const p = placement
  const y0 = Math.max(0, Math.floor((p.top - 0.14) * height))
  const y1 = Math.min(height, Math.ceil((p.top + 0.14) * height))
  const x0 = Math.max(0, Math.floor((p.left - 0.02) * width))
  const x1 = Math.min(width, Math.ceil((p.left + p.width + 0.02) * width))
  const cropW = x1 - x0
  const cropH = y1 - y0
  if (cropW < 8 || cropH < 8) return { duplicate: false, bands: 0, detail: 'crop too small' }

  const rowScore = new Float32Array(cropH)
  for (let row = 0; row < cropH; row++) {
    const absY = y0 + row
    let textish = 0
    for (let col = 0; col < cropW; col++) {
      const absX = x0 + col
      const i = (absY * width + absX) * 4
      const r = data[i]
      const g = data[i + 1]
      const b = data[i + 2]
      const lum = 0.299 * r + 0.587 * g + 0.114 * b
      const chroma = Math.max(r, g, b) - Math.min(r, g, b)
      if (lum > 165 && chroma < 95) textish++
      else if (lum < 72 && chroma < 50) textish++
    }
    rowScore[row] = textish / cropW
  }

  const thresh = 0.035
  const minRun = 2
  const bands = []
  let runStart = -1
  for (let row = 0; row <= cropH; row++) {
    const hot = row < cropH && rowScore[row] >= thresh
    if (hot && runStart < 0) runStart = row
    if (!hot && runStart >= 0) {
      const runLen = row - runStart
      if (runLen >= minRun) {
        let peak = 0
        for (let r = runStart; r < row; r++) peak = Math.max(peak, rowScore[r])
        bands.push({ start: runStart, end: row, peak, height: runLen })
      }
      runStart = -1
    }
  }

  if (bands.length < 2) {
    return { duplicate: false, bands: bands.length, detail: `single band (${bands.length})` }
  }

  const sorted = [...bands].sort((a, b) => a.start - b.start)
  for (let i = 0; i < sorted.length - 1; i++) {
    const a = sorted[i]
    const b = sorted[i + 1]
    const gap = b.start - a.end
    if (gap < 1) continue
    const peakRatio = Math.min(a.peak, b.peak) / Math.max(a.peak, b.peak)
    if (peakRatio > 0.45 && a.height >= minRun && b.height >= minRun) {
      return {
        duplicate: true,
        bands: bands.length,
        detail: `two text bands gap=${gap}px peaks=${a.peak.toFixed(3)}/${b.peak.toFixed(3)}`,
      }
    }
  }

  return { duplicate: false, bands: bands.length, detail: `bands=${bands.length} not paired` }
}
