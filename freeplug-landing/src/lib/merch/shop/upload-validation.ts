export const MERCH_SHOP_UPLOAD_MAX_BYTES = 20 * 1024 * 1024
export const MERCH_SHOP_MIN_EFFECTIVE_DPI = 150

const ALLOWED_MIME = new Set(['image/png', 'image/jpeg', 'image/jpg', 'image/svg+xml'])

export function validateMerchShopUploadMime(contentType: string | null): boolean {
  if (!contentType) return false
  const base = contentType.split(';')[0]?.trim().toLowerCase() ?? ''
  return ALLOWED_MIME.has(base)
}

export function validateMerchShopUploadSize(byteLength: number): boolean {
  return byteLength > 0 && byteLength <= MERCH_SHOP_UPLOAD_MAX_BYTES
}

/**
 * Effective DPI at the declared print size (widthIn × heightIn in inches).
 */
export function effectiveDpi(pixelWidth: number, pixelHeight: number, widthIn: number, heightIn: number): number {
  if (widthIn <= 0 || heightIn <= 0) return 0
  const wDpi = pixelWidth / widthIn
  const hDpi = pixelHeight / heightIn
  return Math.min(wDpi, hDpi)
}

export function isDpiWarning(dpi: number): boolean {
  return dpi > 0 && dpi < MERCH_SHOP_MIN_EFFECTIVE_DPI
}

export function meetsMinDpi(pixelWidth: number, pixelHeight: number, widthIn: number, heightIn: number): boolean {
  const dpi = effectiveDpi(pixelWidth, pixelHeight, widthIn, heightIn)
  return dpi >= MERCH_SHOP_MIN_EFFECTIVE_DPI
}

export function parseDataUrlDimensions(dataUrl: string): { width: number; height: number; mime: string } | null {
  const m = /^data:([^;]+);base64,(.+)$/i.exec(dataUrl.trim())
  if (!m) return null
  const mime = m[1].toLowerCase()
  if (mime === 'image/svg+xml') {
    const svg = Buffer.from(m[2], 'base64').toString('utf8')
    const wm = /width=\"(\d+)/i.exec(svg)
    const hm = /height=\"(\d+)/i.exec(svg)
    const width = wm ? parseInt(wm[1], 10) : 1200
    const height = hm ? parseInt(hm[1], 10) : 1200
    return { width, height, mime }
  }
  const buf = Buffer.from(m[2], 'base64')
  if (mime.includes('png') && buf.length > 24) {
    const width = buf.readUInt32BE(16)
    const height = buf.readUInt32BE(20)
    return { width, height, mime }
  }
  if (mime.includes('jpeg') || mime.includes('jpg')) {
    let i = 2
    while (i < buf.length) {
      if (buf[i] !== 0xff) break
      const marker = buf[i + 1]
      if (marker === 0xc0 || marker === 0xc2) {
        const height = buf.readUInt16BE(i + 5)
        const width = buf.readUInt16BE(i + 7)
        return { width, height, mime }
      }
      const len = buf.readUInt16BE(i + 2)
      i += 2 + len
    }
  }
  return null
}
