import { randomBytes } from 'node:crypto'
import sharp from 'sharp'
import { PHOTO_LIMITS } from './limits'

/**
 * Upload checks for outreach photos and screenshots (Vera rule 2, Aria section 5):
 *   1. size cap before anything else;
 *   2. magic bytes: JPEG, PNG or WebP only (no SVG, GIF, HEIC or anything renamed);
 *   3. decode and re-encode with sharp to JPEG, which rejects files that only look like images,
 *      applies the EXIF orientation and then drops all metadata (EXIF, GPS, XMP, ICC comments);
 *   4. a random file name; the uploaded name is never used.
 * The browser already converts HEIC and resizes to JPEG before upload (client-image.ts).
 */

export type DetectedImageType = 'jpeg' | 'png' | 'webp'

/** Server cap per photo after the browser resize (the browser refuses originals over 10 MB). */
export const MAX_PHOTO_UPLOAD_BYTES = PHOTO_LIMITS.maxUploadBytes
export const MAX_SCREENSHOT_UPLOAD_BYTES = 5 * 1024 * 1024
export const PHOTO_MAX_DIMENSION = PHOTO_LIMITS.maxDimension
export const SCREENSHOT_MAX_WIDTH = 1600

export function detectImageType(buf: Uint8Array): DetectedImageType | null {
  if (buf.length >= 3 && buf[0] === 0xff && buf[1] === 0xd8 && buf[2] === 0xff) return 'jpeg'
  if (
    buf.length >= 8 &&
    buf[0] === 0x89 && buf[1] === 0x50 && buf[2] === 0x4e && buf[3] === 0x47 &&
    buf[4] === 0x0d && buf[5] === 0x0a && buf[6] === 0x1a && buf[7] === 0x0a
  ) {
    return 'png'
  }
  if (
    buf.length >= 12 &&
    buf[0] === 0x52 && buf[1] === 0x49 && buf[2] === 0x46 && buf[3] === 0x46 && // RIFF
    buf[8] === 0x57 && buf[9] === 0x45 && buf[10] === 0x42 && buf[11] === 0x50 // WEBP
  ) {
    return 'webp'
  }
  return null
}

export type ProcessedImage = { data: Buffer; width: number; height: number; bytes: number }
export type ImageCheckResult =
  | { ok: true; image: ProcessedImage }
  | { ok: false; reason: 'too_large' | 'bad_type' | 'unreadable' }

export async function processUploadedImage(
  input: Uint8Array,
  kind: 'photo' | 'screenshot'
): Promise<ImageCheckResult> {
  const max = kind === 'photo' ? MAX_PHOTO_UPLOAD_BYTES : MAX_SCREENSHOT_UPLOAD_BYTES
  if (input.length === 0 || input.length > max) return { ok: false, reason: input.length ? 'too_large' : 'bad_type' }
  if (!detectImageType(input)) return { ok: false, reason: 'bad_type' }
  try {
    let pipeline = sharp(Buffer.from(input), {
      failOn: 'error',
      limitInputPixels: kind === 'photo' ? 60_000_000 : 120_000_000,
    }).rotate()
    pipeline =
      kind === 'photo'
        ? pipeline.resize({
            width: PHOTO_MAX_DIMENSION,
            height: PHOTO_MAX_DIMENSION,
            fit: 'inside',
            withoutEnlargement: true,
          })
        : pipeline.resize({ width: SCREENSHOT_MAX_WIDTH, withoutEnlargement: true })
    const { data, info } = await pipeline
      .flatten({ background: '#ffffff' })
      .jpeg({ quality: kind === 'photo' ? 85 : 82, mozjpeg: true })
      .toBuffer({ resolveWithObject: true })
    return { ok: true, image: { data, width: info.width, height: info.height, bytes: data.length } }
  } catch {
    return { ok: false, reason: 'unreadable' }
  }
}

export function randomObjectName(): string {
  return randomBytes(16).toString('hex')
}
