import type { ImagesBindingLike } from '@/lib/outreach/image-codec-cloudflare'

/**
 * Downscaled copy of a custom upload for the llava moderation call only (the original bytes are
 * what gets stored and printed). Large images made llava time out, which held every big upload.
 *
 * Returns null when a large image cannot be downscaled; the caller then holds the upload (fail-safe).
 */
export const SHOP_MODERATION_MAX_SIDE = 1024
/** Images at or under this size and side length go to llava unchanged. */
export const SHOP_MODERATION_PASSTHROUGH_BYTES = 1024 * 1024
const MODERATION_JPEG_QUALITY = 85

function streamOf(bytes: Uint8Array): ReadableStream<Uint8Array> {
  return new Response(bytes as BodyInit).body as ReadableStream<Uint8Array>
}

async function bytesOf(stream: ReadableStream<Uint8Array>): Promise<Uint8Array> {
  return new Uint8Array(await new Response(stream).arrayBuffer())
}

export async function shopModerationImageBytes(
  bytes: Uint8Array,
  mime: string,
  images: ImagesBindingLike | null,
  dims?: { width: number; height: number } | null
): Promise<Uint8Array | null> {
  const small = bytes.length <= SHOP_MODERATION_PASSTHROUGH_BYTES
  const withinSide = dims ? Math.max(dims.width, dims.height) <= SHOP_MODERATION_MAX_SIDE : false
  // SVG is not a bitmap for the Images binding; llava gets it as-is (and holds it if it cannot read it).
  if (mime === 'image/svg+xml') return bytes
  if (small && withinSide) return bytes
  if (!images) return small ? bytes : null
  try {
    const result = await images
      .input(streamOf(bytes))
      .transform({ width: SHOP_MODERATION_MAX_SIDE, height: SHOP_MODERATION_MAX_SIDE, fit: 'scale-down' })
      .output({ format: 'image/jpeg', quality: MODERATION_JPEG_QUALITY, background: '#ffffff' })
    const out = await bytesOf(result.image())
    if (!out.length) return small ? bytes : null
    return out
  } catch {
    return small ? bytes : null
  }
}
