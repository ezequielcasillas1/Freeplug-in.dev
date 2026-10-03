import { randomBytes } from 'node:crypto'
import { PHOTO_LIMITS } from './limits'
import { isJpeg, stripJpegMetadata } from './jpeg-metadata'

/**
 * Upload checks for outreach photos and screenshots (Vera rule 2, Aria section 5):
 *   1. size cap before anything else;
 *   2. magic bytes: JPEG, PNG or WebP only (no SVG, GIF, HEIC or anything renamed);
 *   3. decode and re-encode to JPEG through an ImageCodec, which rejects files that only look like
 *      images, applies the EXIF orientation, fits inside the size cap without enlarging, and
 *      flattens transparency onto white;
 *   4. every APPn/COM metadata segment is then stripped from the JPEG bytes here (EXIF, GPS, XMP,
 *      IPTC, comments), whatever the codec did. This is a Privacy Policy fact; see jpeg-metadata.ts;
 *   5. a random file name; the uploaded name is never used.
 * The browser already converts HEIC and resizes to JPEG before upload (client-image.ts).
 *
 * Codec (Cloudflare port, Oct 3): production uses the Cloudflare Images binding
 * (image-codec-cloudflare.ts, env.IMAGES). sharp can't load on Workers, so it is NOT imported by
 * any app file; tests inject the sharp adapter in test/image-codec-sharp.ts with setImageCodec().
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

/** What a codec must do with one upload. Same numbers as the sharp pipeline before the port. */
export type ImageReencodeSpec = {
  /** Fit inside maxWidth x maxHeight (height optional), keep the aspect ratio, never enlarge. */
  maxWidth: number
  maxHeight?: number
  /** JPEG quality, 1-100. */
  quality: number
  /** Refuse decoded images with more pixels than this (decompression-bomb guard). */
  maxInputPixels: number
}

export type EncodedImage = { data: Uint8Array; width: number; height: number }

/**
 * Decode + auto-rotate + resize (inside, no enlargement) + flatten on white + JPEG encode.
 * Must THROW for anything it can't decode; processUploadedImage turns that into 'unreadable'.
 */
export interface ImageCodec {
  readonly name: string
  reencodeToJpeg(input: Uint8Array, spec: ImageReencodeSpec): Promise<EncodedImage>
}

let codecOverride: ImageCodec | null = null

/** Tests (and only tests) swap the codec, e.g. for the sharp adapter. Pass null to reset. */
export function setImageCodec(codec: ImageCodec | null): void {
  codecOverride = codec
}

async function currentCodec(): Promise<ImageCodec> {
  if (codecOverride) return codecOverride
  // Lazy so that modules which only need detectImageType/randomObjectName don't load the adapter.
  const { cloudflareImagesCodec } = await import('./image-codec-cloudflare')
  return cloudflareImagesCodec
}

export function reencodeSpecFor(kind: 'photo' | 'screenshot'): ImageReencodeSpec {
  return kind === 'photo'
    ? { maxWidth: PHOTO_MAX_DIMENSION, maxHeight: PHOTO_MAX_DIMENSION, quality: 85, maxInputPixels: 60_000_000 }
    : { maxWidth: SCREENSHOT_MAX_WIDTH, quality: 82, maxInputPixels: 120_000_000 }
}

export async function processUploadedImage(
  input: Uint8Array,
  kind: 'photo' | 'screenshot'
): Promise<ImageCheckResult> {
  const max = kind === 'photo' ? MAX_PHOTO_UPLOAD_BYTES : MAX_SCREENSHOT_UPLOAD_BYTES
  if (input.length === 0 || input.length > max) return { ok: false, reason: input.length ? 'too_large' : 'bad_type' }
  if (!detectImageType(input)) return { ok: false, reason: 'bad_type' }
  try {
    const codec = await currentCodec()
    const encoded = await codec.reencodeToJpeg(input, reencodeSpecFor(kind))
    if (!isJpeg(encoded.data) || !(encoded.width > 0) || !(encoded.height > 0)) return { ok: false, reason: 'unreadable' }
    const data = Buffer.from(stripJpegMetadata(encoded.data))
    return { ok: true, image: { data, width: encoded.width, height: encoded.height, bytes: data.length } }
  } catch (e) {
    console.error('[outreach] image re-encode failed', e instanceof Error ? e.message : 'unknown error')
    return { ok: false, reason: 'unreadable' }
  }
}

export function randomObjectName(): string {
  return randomBytes(16).toString('hex')
}
