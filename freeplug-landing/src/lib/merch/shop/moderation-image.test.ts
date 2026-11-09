import { describe, expect, it } from 'vitest'
import type { ImagesBindingLike } from '@/lib/outreach/image-codec-cloudflare'
import { SHOP_MODERATION_MAX_SIDE, SHOP_MODERATION_PASSTHROUGH_BYTES, shopModerationImageBytes } from './moderation-image'

function fakeImages(out: Uint8Array | Error): ImagesBindingLike & { transforms: unknown[] } {
  const transforms: unknown[] = []
  const transformer = {
    transform(t: unknown) {
      transforms.push(t)
      return transformer
    },
    async output() {
      if (out instanceof Error) throw out
      return { image: () => new Response(out as BodyInit).body as ReadableStream<Uint8Array> }
    },
  }
  return {
    transforms,
    async info() {
      return { format: 'image/png', width: 3000, height: 3000 }
    },
    input() {
      return transformer
    },
  }
}

const big = new Uint8Array(SHOP_MODERATION_PASSTHROUGH_BYTES + 10)
const small = new Uint8Array(1000)

describe('shop moderation image downscale', () => {
  it('passes small images within the side limit through unchanged', async () => {
    const images = fakeImages(new Uint8Array([9]))
    const r = await shopModerationImageBytes(small, 'image/png', images, { width: 800, height: 600 })
    expect(r).toBe(small)
    expect(images.transforms).toEqual([])
  })

  it('downscales large images to the max side (scale-down) for moderation', async () => {
    const images = fakeImages(new Uint8Array([1, 2, 3]))
    const r = await shopModerationImageBytes(big, 'image/png', images, { width: 3000, height: 3000 })
    expect(Array.from(r!)).toEqual([1, 2, 3])
    expect(images.transforms).toEqual([
      { width: SHOP_MODERATION_MAX_SIDE, height: SHOP_MODERATION_MAX_SIDE, fit: 'scale-down' },
    ])
  })

  it('downscales small files with large dimensions too', async () => {
    const images = fakeImages(new Uint8Array([4]))
    const r = await shopModerationImageBytes(small, 'image/png', images, { width: 3000, height: 1500 })
    expect(Array.from(r!)).toEqual([4])
  })

  it('returns null (held) when a large image cannot be downscaled', async () => {
    expect(await shopModerationImageBytes(big, 'image/png', fakeImages(new Error('9422')), { width: 3000, height: 3000 })).toBeNull()
    expect(await shopModerationImageBytes(big, 'image/png', null, { width: 3000, height: 3000 })).toBeNull()
    expect(await shopModerationImageBytes(big, 'image/png', fakeImages(new Uint8Array()), { width: 3000, height: 3000 })).toBeNull()
  })

  it('falls back to the original for small files when downscale fails', async () => {
    const r = await shopModerationImageBytes(small, 'image/png', fakeImages(new Error('x')), { width: 3000, height: 3000 })
    expect(r).toBe(small)
  })

  it('leaves SVG unchanged', async () => {
    const svg = new Uint8Array([60, 115, 118, 103])
    expect(await shopModerationImageBytes(svg, 'image/svg+xml', fakeImages(new Uint8Array([1])), null)).toBe(svg)
  })
})
