import sharp from 'sharp'
import type { ImageCodec } from '@/lib/outreach/image'

/**
 * TEST-ONLY ImageCodec: the exact sharp pipeline the app used before the Cloudflare port
 * (auto-rotate, fit inside without enlargement, flatten on white, JPEG). sharp is a devDependency
 * and can't load on Workers, so no file under src/ may import this; tests inject it with
 * setImageCodec(sharpImageCodec). The guard test in src/lib/outreach/image.test.ts checks that.
 */
export const sharpImageCodec: ImageCodec = {
  name: 'sharp-test-adapter',
  async reencodeToJpeg(input, spec) {
    const { data, info } = await sharp(Buffer.from(input), { failOn: 'error', limitInputPixels: spec.maxInputPixels })
      .rotate()
      .resize({ width: spec.maxWidth, height: spec.maxHeight, fit: 'inside', withoutEnlargement: true })
      .flatten({ background: '#ffffff' })
      .jpeg({ quality: spec.quality, mozjpeg: true })
      .toBuffer({ resolveWithObject: true })
    return { data: new Uint8Array(data), width: info.width, height: info.height }
  },
}
