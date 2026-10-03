// @vitest-environment node
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest'
import sharp from 'sharp'
import { generatePreviewToken, hashPreviewToken, isLinkUsable, isWellFormedToken, linkExpiryFrom, extendedExpiry } from './token'
import { signSiteCookie, verifySiteCookie } from './cookie'
import { detectImageType, processUploadedImage, setImageCodec } from './image'
import { sharpImageCodec } from '../../../test/image-codec-sharp'
import { TURNSTILE_TEST_SECRET_KEY, turnstileSecret, verifyTurnstile } from './turnstile'
import { PHOTO_LIMITS } from './limits'

describe('preview tokens', () => {
  it('are 32 random bytes (43 base64url chars) stored only as their SHA-256 hash', () => {
    const { token, tokenHash } = generatePreviewToken()
    expect(token).toMatch(/^[A-Za-z0-9_-]{43}$/)
    expect(tokenHash).toMatch(/^[0-9a-f]{64}$/)
    expect(hashPreviewToken(token)).toBe(tokenHash)
    expect(tokenHash).not.toContain(token)
  })

  it('never repeat and malformed ones are rejected before any lookup', () => {
    const seen = new Set(Array.from({ length: 2000 }, () => generatePreviewToken().token))
    expect(seen.size).toBe(2000)
    for (const bad of ['', 'abc', 'a'.repeat(44), '../../etc', 'x'.repeat(42) + '=', null, 12]) {
      expect(isWellFormedToken(bad)).toBe(false)
    }
  })

  it('unknown, expired, revoked and claimed all read as the same "not usable"', () => {
    const now = new Date('2026-09-27T06:00:00Z')
    const base = { expires_at: '2026-10-27T06:00:00Z', revoked_at: null, claimed_by: null }
    expect(isLinkUsable(base, now)).toBe(true)
    expect(isLinkUsable(null, now)).toBe(false)
    expect(isLinkUsable({ ...base, expires_at: '2026-09-27T05:59:59Z' }, now)).toBe(false)
    expect(isLinkUsable({ ...base, revoked_at: '2026-09-27T05:00:00Z' }, now)).toBe(false)
    expect(isLinkUsable({ ...base, claimed_by: 'user-1' }, now)).toBe(false)
  })

  it('lives 30 days and admin extends by 30 days', () => {
    const now = new Date('2026-09-27T06:00:00Z')
    expect(linkExpiryFrom(now).toISOString()).toBe('2026-10-27T06:00:00.000Z')
    expect(extendedExpiry(new Date('2026-10-01T00:00:00Z'), now).getTime()).toBeGreaterThan(new Date('2026-10-01T00:00:00Z').getTime())
  })
})

describe('signed preview cookie', () => {
  const id = '11111111-2222-4333-8444-555555555555'
  it('round-trips and rejects tampering, other secrets and expiry', () => {
    const v = signSiteCookie(id, 'secret-a', 60, 1_000)
    expect(verifySiteCookie(v, 'secret-a', 2_000)).toBe(id)
    expect(verifySiteCookie(v, 'secret-b', 2_000)).toBeNull()
    expect(verifySiteCookie(v.replace(id, '11111111-2222-4333-8444-555555555556'), 'secret-a', 2_000)).toBeNull()
    expect(verifySiteCookie(v, 'secret-a', 1_000 + 61_000)).toBeNull()
    expect(verifySiteCookie('garbage', 'secret-a')).toBeNull()
  })
})

describe('uploaded images (server backstop)', () => {
  // sharp can't run on Workers; tests use the same pipeline through the test-only adapter.
  beforeAll(() => setImageCodec(sharpImageCodec))
  afterAll(() => setImageCodec(null))

  it('refuses a renamed .txt and an SVG by their bytes', async () => {
    const txt = new TextEncoder().encode('hello, this is not a photo')
    const svg = new TextEncoder().encode('<svg xmlns="http://www.w3.org/2000/svg"><script>alert(1)</script></svg>')
    expect(detectImageType(txt)).toBeNull()
    expect(detectImageType(svg)).toBeNull()
    expect(await processUploadedImage(txt, 'photo')).toEqual({ ok: false, reason: 'bad_type' })
    expect(await processUploadedImage(svg, 'photo')).toEqual({ ok: false, reason: 'bad_type' })
  })

  it('refuses HEIC (the browser must convert it first) and anything over 5 MB', async () => {
    const heic = new Uint8Array([0, 0, 0, 0x18, 0x66, 0x74, 0x79, 0x70, 0x68, 0x65, 0x69, 0x63, 0, 0, 0, 0])
    expect(await processUploadedImage(heic, 'photo')).toEqual({ ok: false, reason: 'bad_type' })
    const big = new Uint8Array(PHOTO_LIMITS.maxUploadBytes + 1)
    big.set([0xff, 0xd8, 0xff])
    expect(await processUploadedImage(big, 'photo')).toEqual({ ok: false, reason: 'too_large' })
  })

  it('re-encodes to JPEG and strips EXIF (GPS, camera) metadata', async () => {
    const withExif = await sharp({ create: { width: 64, height: 48, channels: 3, background: '#3a7' } })
      .jpeg()
      .withExif({ IFD0: { Make: 'SecretCam', Model: 'Model X' }, IFD3: { GPSLatitudeRef: 'N', GPSLatitude: '29/1 53/1 0/1' } })
      .toBuffer()
    expect((await sharp(withExif).metadata()).exif).toBeDefined()
    const out = await processUploadedImage(new Uint8Array(withExif), 'photo')
    expect(out.ok).toBe(true)
    if (!out.ok) return
    const meta = await sharp(out.image.data).metadata()
    expect(meta.format).toBe('jpeg')
    expect(meta.exif).toBeUndefined()
    expect(out.image.data.includes(Buffer.from('SecretCam'))).toBe(false)
  })
})

describe('Turnstile', () => {
  it('uses the official test secret outside production and fails closed in production without a secret', () => {
    expect(turnstileSecret({ nodeEnv: 'development' })).toBe(TURNSTILE_TEST_SECRET_KEY)
    expect(turnstileSecret({ nodeEnv: 'production' })).toBeNull()
  })

  it('verifies with Cloudflare and refuses a missing token without calling it', async () => {
    const fetchImpl = vi.fn(async () => new Response(JSON.stringify({ success: true }), { status: 200 }))
    expect(await verifyTurnstile(null, '1.2.3.4', { secret: 's', fetchImpl })).toBe(false)
    expect(fetchImpl).not.toHaveBeenCalled()
    expect(await verifyTurnstile('tok', '1.2.3.4', { secret: 's', fetchImpl })).toBe(true)
    const failing = vi.fn(async () => new Response(JSON.stringify({ success: false }), { status: 200 }))
    expect(await verifyTurnstile('tok', null, { secret: 's', fetchImpl: failing })).toBe(false)
  })

  it('sends remoteip only for a real client IP, never the shared "unknown-ip" bucket (Vera r2 N6)', async () => {
    const bodies: URLSearchParams[] = []
    const fetchImpl = vi.fn(async (_u: unknown, init?: RequestInit) => {
      bodies.push(init?.body as URLSearchParams)
      return new Response(JSON.stringify({ success: true }), { status: 200 })
    })
    await verifyTurnstile('tok', 'unknown-ip', { secret: 's', fetchImpl })
    await verifyTurnstile('tok', '203.0.113.9', { secret: 's', fetchImpl })
    expect(bodies[0].has('remoteip')).toBe(false)
    expect(bodies[1].get('remoteip')).toBe('203.0.113.9')
  })
})
