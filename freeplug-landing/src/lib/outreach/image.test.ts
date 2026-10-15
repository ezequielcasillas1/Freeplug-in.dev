// @vitest-environment node
import { readFileSync, readdirSync, statSync } from 'node:fs'
import path from 'node:path'
import sharp from 'sharp'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { sharpImageCodec } from '../../../test/image-codec-sharp'
import { processUploadedImage, reencodeSpecFor, setImageCodec, type ImageCodec } from './image'
import { jpegMetadataSegmentNames, jpegSegments, stripJpegMetadata } from './jpeg-metadata'

/*
 * Cloudflare port (Oct 3): the upload pipeline behind processUploadedImage() without sharp in the
 * app. The real pixels go through the test-only sharp adapter; the Images binding path is checked
 * with a stand-in binding. The Privacy Policy fact "photos lose their location and camera data"
 * is the gate here.
 */

const cfContext = vi.hoisted(() => ({ env: {} as Record<string, unknown> }))
vi.mock('@opennextjs/cloudflare', () => ({ getCloudflareContext: async () => cfContext }))

afterEach(() => {
  setImageCodec(null)
  cfContext.env = {}
})

const GPS_EXIF = {
  IFD0: { Make: 'SecretCam', Model: 'Model X', Artist: 'Jane Owner', Copyright: 'Jane Owner 2026' },
  IFD3: { GPSLatitudeRef: 'N', GPSLatitude: '29/1 53/1 0/1', GPSLongitudeRef: 'W', GPSLongitude: '97/1 56/1 0/1' },
}

async function gpsTaggedJpeg(width = 64, height = 48, orientation?: number): Promise<Uint8Array> {
  let img = sharp({ create: { width, height, channels: 3, background: '#3a7' } }).jpeg()
  img = img.withExif(GPS_EXIF)
  const buf = await img.toBuffer()
  if (orientation) return new Uint8Array(await sharp(buf).withMetadata({ orientation }).jpeg().toBuffer())
  return new Uint8Array(buf)
}

function containsAscii(buf: Uint8Array, text: string): boolean {
  return Buffer.from(buf).includes(Buffer.from(text))
}

describe('processUploadedImage through the test adapter (same pipeline as before the port)', () => {
  it('a GPS-tagged photo comes out as a JPEG with no EXIF, GPS, camera or copyright data', async () => {
    setImageCodec(sharpImageCodec)
    const input = await gpsTaggedJpeg()
    const before = await sharp(Buffer.from(input)).metadata()
    expect(before.exif).toBeDefined()
    expect(containsAscii(input, 'SecretCam')).toBe(true)
    expect(jpegMetadataSegmentNames(input)).toContain('APP1')

    const out = await processUploadedImage(input, 'photo')
    expect(out.ok).toBe(true)
    if (!out.ok) return
    const meta = await sharp(out.image.data).metadata()
    expect(meta.format).toBe('jpeg')
    expect(meta.exif).toBeUndefined()
    expect(meta.xmp).toBeUndefined()
    expect(meta.iptc).toBeUndefined()
    for (const s of ['SecretCam', 'Model X', 'Jane Owner', 'GPS', 'Exif']) expect(containsAscii(out.image.data, s)).toBe(false)
    expect(jpegMetadataSegmentNames(out.image.data)).toEqual([])
    expect(out.image).toMatchObject({ width: 64, height: 48, bytes: out.image.data.length })
  })

  it('applies the EXIF orientation (auto-rotate) before the metadata is dropped', async () => {
    setImageCodec(sharpImageCodec)
    const rotated = await gpsTaggedJpeg(64, 48, 6) // 6 = rotate 90° clockwise to display
    const out = await processUploadedImage(rotated, 'photo')
    expect(out.ok && [out.image.width, out.image.height]).toEqual([48, 64])
  })

  it('fits photos inside 2560 px and screenshots to 1600 px wide, never enlarging', async () => {
    setImageCodec(sharpImageCodec)
    const wide = new Uint8Array(await sharp({ create: { width: 3000, height: 1000, channels: 3, background: '#123' } }).png().toBuffer())
    const photo = await processUploadedImage(wide, 'photo')
    expect(photo.ok && [photo.image.width, photo.image.height]).toEqual([2560, 853])
    const shot = await processUploadedImage(wide, 'screenshot')
    expect(shot.ok && [shot.image.width, shot.image.height]).toEqual([1600, 533])
    const small = new Uint8Array(await sharp({ create: { width: 100, height: 50, channels: 3, background: '#123' } }).webp().toBuffer())
    const kept = await processUploadedImage(small, 'photo')
    expect(kept.ok && [kept.image.width, kept.image.height]).toEqual([100, 50])
  })

  it('flattens transparency onto white', async () => {
    setImageCodec(sharpImageCodec)
    const clear = new Uint8Array(await sharp({ create: { width: 8, height: 8, channels: 4, background: { r: 0, g: 0, b: 0, alpha: 0 } } }).png().toBuffer())
    const out = await processUploadedImage(clear, 'photo')
    expect(out.ok).toBe(true)
    if (!out.ok) return
    const { data } = await sharp(out.image.data).raw().toBuffer({ resolveWithObject: true })
    expect(Math.min(...data)).toBeGreaterThan(245)
  })

  it('a file that only looks like a JPEG is unreadable', async () => {
    setImageCodec(sharpImageCodec)
    const fake = new Uint8Array(4096)
    fake.set([0xff, 0xd8, 0xff, 0xe0])
    expect(await processUploadedImage(fake, 'photo')).toEqual({ ok: false, reason: 'unreadable' })
  })
})

/** A stand-in for env.IMAGES that records calls and re-encodes with sharp (like miniflare). */
function fakeImagesBinding(opts: { keepExif?: boolean; infoThrows?: boolean; svg?: boolean } = {}) {
  const calls: { transform: unknown[]; output: unknown[]; info: number } = { transform: [], output: [], info: 0 }
  const read = async (s: ReadableStream<Uint8Array>) => Buffer.from(await new Response(s).arrayBuffer())
  const binding = {
    async info(stream: ReadableStream<Uint8Array>) {
      calls.info++
      if (opts.infoThrows) throw Object.assign(new Error('ERROR 9412: not an image'), { code: 9412 })
      if (opts.svg) return { format: 'image/svg+xml' }
      const m = await sharp(await read(stream)).metadata()
      return { format: `image/${m.format}`, fileSize: m.size ?? 0, width: m.width, height: m.height }
    },
    input(stream: ReadableStream<Uint8Array>) {
      let t: { width?: number; height?: number } = {}
      const transformer = {
        transform(x: { width?: number; height?: number }) {
          calls.transform.push(x)
          t = x
          return transformer
        },
        async output(o: { format: string; quality?: number; background?: string }) {
          calls.output.push(o)
          let p = sharp(await read(stream)).rotate().resize({ width: t.width, height: t.height, fit: 'inside', withoutEnlargement: true })
          if (opts.keepExif) p = p.withExif(GPS_EXIF) // simulate an encoder that keeps EXIF
          const data = await p.flatten({ background: o.background ?? '#ffffff' }).jpeg({ quality: o.quality }).toBuffer()
          return { image: () => new Response(new Uint8Array(data)).body as ReadableStream<Uint8Array> }
        },
      }
      return transformer
    },
  }
  return { binding, calls }
}

describe('Cloudflare Images codec (default in the app, env.IMAGES)', () => {
  it('asks the binding for a scale-down fit inside 2560 px and JPEG on white at quality 85', async () => {
    const { binding, calls } = fakeImagesBinding()
    cfContext.env = { IMAGES: binding }
    const out = await processUploadedImage(await gpsTaggedJpeg(), 'photo')
    expect(out.ok).toBe(true)
    expect(calls.transform).toEqual([{ width: 2560, height: 2560, fit: 'scale-down' }])
    expect(calls.output).toEqual([{ format: 'image/jpeg', quality: 85, background: '#ffffff' }])
    expect(calls.info).toBe(2) // validate the input, then read the output size (info is not billed)
    const shot = await processUploadedImage(await gpsTaggedJpeg(), 'screenshot')
    expect(shot.ok).toBe(true)
    expect(calls.transform[1]).toEqual({ width: 1600, fit: 'scale-down' })
    expect(calls.output[1]).toEqual({ format: 'image/jpeg', quality: 82, background: '#ffffff' })
  })

  it('strips GPS and camera EXIF even if the binding returned it (JPEG default keeps the copyright tag)', async () => {
    const { binding } = fakeImagesBinding({ keepExif: true })
    cfContext.env = { IMAGES: binding }
    const out = await processUploadedImage(await gpsTaggedJpeg(), 'photo')
    expect(out.ok).toBe(true)
    if (!out.ok) return
    expect((await sharp(out.image.data).metadata()).exif).toBeUndefined()
    for (const s of ['SecretCam', 'Jane Owner', 'Exif']) expect(containsAscii(out.image.data, s)).toBe(false)
    expect(jpegMetadataSegmentNames(out.image.data)).toEqual([])
  })

  it('fails closed: no binding, a binding error, SVG or too many pixels are all "unreadable"', async () => {
    const quiet = vi.spyOn(console, 'error').mockImplementation(() => {})
    const jpeg = await gpsTaggedJpeg()
    expect(await processUploadedImage(jpeg, 'photo')).toEqual({ ok: false, reason: 'unreadable' })
    cfContext.env = { IMAGES: fakeImagesBinding({ infoThrows: true }).binding }
    expect(await processUploadedImage(jpeg, 'photo')).toEqual({ ok: false, reason: 'unreadable' })
    cfContext.env = { IMAGES: fakeImagesBinding({ svg: true }).binding }
    expect(await processUploadedImage(jpeg, 'photo')).toEqual({ ok: false, reason: 'unreadable' })
    const notJpeg: ImageCodec = { name: 'x', reencodeToJpeg: async () => ({ data: new Uint8Array([1, 2, 3]), width: 1, height: 1 }) }
    setImageCodec(notJpeg) // a codec that returns something that isn't a JPEG
    expect(await processUploadedImage(jpeg, 'photo')).toEqual({ ok: false, reason: 'unreadable' })
    setImageCodec(null)
    const huge = await sharp({ create: { width: 9000, height: 7000, channels: 3, background: '#000' } }).jpeg({ quality: 10 }).toBuffer()
    cfContext.env = { IMAGES: fakeImagesBinding().binding }
    expect(9000 * 7000).toBeGreaterThan(reencodeSpecFor('photo').maxInputPixels)
    expect(await processUploadedImage(new Uint8Array(huge), 'photo')).toEqual({ ok: false, reason: 'unreadable' })
    quiet.mockRestore()
  })
})

describe('stripJpegMetadata', () => {
  /** Inserts raw segments after SOI and appends trailing bytes after EOI. */
  function withSegments(jpeg: Uint8Array, segs: number[][], trailing: number[] = []): Uint8Array {
    return new Uint8Array([...jpeg.subarray(0, 2), ...segs.flat(), ...jpeg.subarray(2), ...trailing])
  }
  const seg = (marker: number, payload: string) => {
    const bytes = [...Buffer.from(payload, 'latin1')]
    const len = bytes.length + 2
    return [0xff, marker, len >> 8, len & 0xff, ...bytes]
  }

  it('removes COM, XMP, IPTC, MPF and trailing data but keeps JFIF and a decodable image', async () => {
    const base = new Uint8Array(await sharp({ create: { width: 16, height: 16, channels: 3, background: '#f00' } }).jpeg().toBuffer())
    const dirty = withSegments(
      base,
      [seg(0xe0, 'JFIF\0\x01\x01\0\0\x01\0\x01\0\0'), seg(0xfe, 'comment: 123 Main St'), seg(0xe1, 'http://ns.adobe.com/xap/1.0/\0<gps>29.9</gps>'), seg(0xed, 'Photoshop 3.0\0IPTC city'), seg(0xe2, 'MPF\0extra')],
      [0xff, 0xd8, 0x01, 0x02]
    )
    expect(jpegMetadataSegmentNames(dirty).sort()).toEqual(['APP1', 'APP13', 'APP2', 'COM'])
    const clean = stripJpegMetadata(dirty)
    expect(jpegMetadataSegmentNames(clean)).toEqual([])
    for (const s of ['123 Main St', '<gps>', 'IPTC', 'MPF']) expect(containsAscii(clean, s)).toBe(false)
    expect(clean[clean.length - 2]).toBe(0xff)
    expect(clean[clean.length - 1]).toBe(0xd9)
    expect(jpegSegments(clean).filter((s) => s.name === 'APP0')).toHaveLength(1) // JFIF header kept
    const m = await sharp(Buffer.from(clean)).metadata()
    expect([m.format, m.width, m.height]).toEqual(['jpeg', 16, 16])
  })

  it('keeps a progressive JPEG decodable', async () => {
    const prog = new Uint8Array(await sharp({ create: { width: 40, height: 30, channels: 3, background: '#0af' } }).withExif(GPS_EXIF).jpeg({ progressive: true }).toBuffer())
    const clean = stripJpegMetadata(prog)
    expect(jpegSegments(clean).filter((s) => s.name === 'SOS').length).toBeGreaterThan(1)
    expect((await sharp(Buffer.from(clean)).metadata()).exif).toBeUndefined()
    const { info } = await sharp(Buffer.from(clean)).raw().toBuffer({ resolveWithObject: true })
    expect([info.width, info.height]).toEqual([40, 30])
  })

  it('throws on a truncated file', () => {
    expect(() => stripJpegMetadata(new Uint8Array([0xff, 0xd8, 0xff, 0xe0, 0x00]))).toThrow()
  })
})

describe('no sharp in the Worker bundle', () => {
  it('no file under src/ imports sharp (it is a test-only devDependency)', () => {
    const root = path.resolve(__dirname, '../../')
    const offenders: string[] = []
    const visit = (dir: string) => {
      for (const name of readdirSync(dir)) {
        const p = path.join(dir, name)
        if (statSync(p).isDirectory()) visit(p)
        else if (/\.(ts|tsx|js|mjs)$/.test(name) && !/\.test\.(ts|tsx)$/.test(name)) {
          if (/from\s+['"]sharp['"]|require\(\s*['"]sharp['"]\s*\)|import\(\s*['"]sharp['"]\s*\)/.test(readFileSync(p, 'utf8'))) offenders.push(path.relative(root, p))
        }
      }
    }
    visit(root)
    expect(offenders).toEqual([])
    const pkg = JSON.parse(readFileSync(path.resolve(root, '../package.json'), 'utf8'))
    expect(pkg.dependencies.sharp).toBeUndefined()
  })
})
