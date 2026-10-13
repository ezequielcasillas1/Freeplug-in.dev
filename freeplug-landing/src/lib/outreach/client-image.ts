/**
 * Browser-side photo prep (runs before upload): type and size checks with Sable's errors, HEIC to
 * JPEG with a lazily loaded heic2any, then resize to at most 2560 px and re-encode as JPEG so one
 * photo fits one server-action request. The server re-checks everything (image.ts).
 */
import { PHOTO_LIMITS } from './limits'

export const MAX_PHOTOS = PHOTO_LIMITS.maxPerLink
export const MAX_ORIGINAL_BYTES = PHOTO_LIMITS.maxOriginalBytes
/** A shrunk photo over this is refused before upload (and by the server as a backstop). */
export const TARGET_MAX_BYTES = PHOTO_LIMITS.maxUploadBytes
export const PHOTO_ACCEPT = 'image/jpeg,image/png,image/webp,image/heic,image/heif,.jpg,.jpeg,.png,.webp,.heic,.heif'

const OK_TYPES = ['image/jpeg', 'image/png', 'image/webp', 'image/heic', 'image/heif']
const OK_EXT = /\.(jpe?g|png|webp|heic|heif)$/i

export type FileCheck = 'ok' | 'bad_type' | 'too_large'

export function isHeic(file: { name: string; type: string }): boolean {
  return /image\/hei[cf]/i.test(file.type) || /\.hei[cf]$/i.test(file.name)
}

export function checkPhotoFile(file: { name: string; type: string; size: number }): FileCheck {
  const typeOk = file.type ? OK_TYPES.includes(file.type.toLowerCase()) : false
  const extOk = OK_EXT.test(file.name)
  // SVG, GIF, text, etc. are refused even if renamed; the server checks the real bytes too.
  if (!(typeOk || (extOk && (!file.type || isHeic(file))))) return 'bad_type'
  if (file.size > MAX_ORIGINAL_BYTES) return 'too_large'
  return 'ok'
}

async function decode(blob: Blob): Promise<{ source: CanvasImageSource; width: number; height: number; close?: () => void }> {
  if (typeof createImageBitmap === 'function') {
    const bmp = await createImageBitmap(blob, { imageOrientation: 'from-image' } as ImageBitmapOptions)
    return { source: bmp, width: bmp.width, height: bmp.height, close: () => bmp.close() }
  }
  const url = URL.createObjectURL(blob)
  try {
    const img = new Image()
    img.src = url
    await img.decode()
    return { source: img, width: img.naturalWidth, height: img.naturalHeight }
  } finally {
    URL.revokeObjectURL(url)
  }
}

function toBlob(canvas: HTMLCanvasElement, quality: number): Promise<Blob> {
  return new Promise((resolve, reject) =>
    canvas.toBlob((b) => (b ? resolve(b) : reject(new Error('encode'))), 'image/jpeg', quality)
  )
}

/** Resizes into a JPEG. `maxWidth`/`maxHeight` bound the output (screenshots keep their height). */
export async function toJpeg(file: Blob & { name?: string; type: string }, opts: { maxWidth: number; maxHeight: number }): Promise<Blob> {
  let src: Blob = file
  if (isHeic({ name: file.name ?? '', type: file.type })) {
    const heic2any = (await import('heic2any')).default
    const out = await heic2any({ blob: file, toType: 'image/jpeg', quality: 0.92 })
    src = Array.isArray(out) ? out[0] : out
  }
  const img = await decode(src)
  try {
    let scale = Math.min(1, opts.maxWidth / img.width, opts.maxHeight / img.height)
    for (const quality of [0.85, 0.75, 0.65]) {
      const canvas = document.createElement('canvas')
      canvas.width = Math.max(1, Math.round(img.width * scale))
      canvas.height = Math.max(1, Math.round(img.height * scale))
      const ctx = canvas.getContext('2d')
      if (!ctx) throw new Error('canvas')
      ctx.fillStyle = '#fff'
      ctx.fillRect(0, 0, canvas.width, canvas.height)
      ctx.drawImage(img.source, 0, 0, canvas.width, canvas.height)
      const blob = await toBlob(canvas, quality)
      if (blob.size <= TARGET_MAX_BYTES) return blob
      scale *= 0.85
    }
    throw new Error('too_large')
  } finally {
    img.close?.()
  }
}

export const preparePhoto = (file: File) =>
  toJpeg(file, { maxWidth: PHOTO_LIMITS.maxDimension, maxHeight: PHOTO_LIMITS.maxDimension })
/** Admin screenshots: keep the full page height (browser canvas limit ~16k px). */
export const prepareScreenshot = (file: File, maxWidth: number) => toJpeg(file, { maxWidth, maxHeight: 16000 })
