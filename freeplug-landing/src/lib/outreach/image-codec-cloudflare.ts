import { getCloudflareContext } from '@opennextjs/cloudflare'
import type { EncodedImage, ImageCodec, ImageReencodeSpec } from './image'

/**
 * ImageCodec backed by the Cloudflare Images binding (`"images": { "binding": "IMAGES" }` in
 * wrangler.jsonc), reached through OpenNext's getCloudflareContext(). Docs:
 * https://developers.cloudflare.com/images/transform-images/bindings/ and
 * https://developers.cloudflare.com/images/optimization/features/
 *
 * Mapping from the old sharp pipeline:
 *   sharp(..., { failOn: 'error', limitInputPixels })  -> IMAGES.info() first (free, not billed):
 *                                                         throws on non-images, SVG refused, pixel cap
 *   .rotate()                                          -> automatic: Cloudflare applies EXIF rotation
 *                                                         even when metadata is discarded
 *   .resize({ fit: 'inside', withoutEnlargement })     -> transform({ width, height, fit: 'scale-down' })
 *   .flatten({ background: '#ffffff' })                -> output({ background: '#ffffff' }) (JPEG has
 *                                                         no alpha; white is also Cloudflare's default)
 *   .jpeg({ quality })                                 -> output({ format: 'image/jpeg', quality })
 *   metadata dropped                                   -> Cloudflare's JPEG default keeps only the EXIF
 *                                                         copyright tag; processUploadedImage then strips
 *                                                         every APPn/COM segment (jpeg-metadata.ts)
 * Output size comes from IMAGES.info() on the encoded bytes.
 *
 * Billing: each call is one unique transformation (Images Free: 5,000 a month; past that new
 * transformations fail with error 9422 and the upload is refused, fail closed).
 * Local `wrangler dev` uses a low-fidelity simulator (width, height, rotate, format only; no EXIF
 * auto-rotate), so orientation and quality must be checked on the preview deploy.
 */

/** The part of Cloudflare's ImagesBinding type we use (from @cloudflare/workers-types). */
export type ImagesBindingLike = {
  info(stream: ReadableStream<Uint8Array>): Promise<{ format: string; fileSize?: number; width?: number; height?: number }>
  input(stream: ReadableStream<Uint8Array>): ImageTransformerLike
}
export type ImageTransformerLike = {
  transform(t: { width?: number; height?: number; fit?: 'scale-down' }): ImageTransformerLike
  output(o: { format: 'image/jpeg'; quality?: number; background?: string }): Promise<{ image(): ReadableStream<Uint8Array> }>
}

function streamOf(bytes: Uint8Array): ReadableStream<Uint8Array> {
  return new Response(bytes as BodyInit).body as ReadableStream<Uint8Array>
}

async function bytesOf(stream: ReadableStream<Uint8Array>): Promise<Uint8Array> {
  return new Uint8Array(await new Response(stream).arrayBuffer())
}

export async function reencodeWithImagesBinding(
  images: ImagesBindingLike,
  input: Uint8Array,
  spec: ImageReencodeSpec
): Promise<EncodedImage> {
  const info = await images.info(streamOf(input))
  if (info.format === 'image/svg+xml' || !info.width || !info.height) throw new Error('not a bitmap image')
  if (info.width * info.height > spec.maxInputPixels) throw new Error('image has too many pixels')
  const result = await images
    .input(streamOf(input))
    .transform({ width: spec.maxWidth, ...(spec.maxHeight ? { height: spec.maxHeight } : {}), fit: 'scale-down' })
    .output({ format: 'image/jpeg', quality: spec.quality, background: '#ffffff' })
  const data = await bytesOf(result.image())
  const out = await images.info(streamOf(data))
  if (out.format !== 'image/jpeg' || !out.width || !out.height) throw new Error('unexpected encoder output')
  return { data, width: out.width, height: out.height }
}

export const cloudflareImagesCodec: ImageCodec = {
  name: 'cloudflare-images',
  async reencodeToJpeg(input, spec) {
    const { env } = await getCloudflareContext({ async: true })
    const images = (env as { IMAGES?: ImagesBindingLike }).IMAGES
    // Fail closed: without the binding (e.g. plain `next start`) every upload is refused.
    if (!images) throw new Error('IMAGES binding is not configured')
    return reencodeWithImagesBinding(images, input, spec)
  },
}
