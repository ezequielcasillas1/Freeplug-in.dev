import { createHash, createHmac, timingSafeEqual } from 'node:crypto'

/**
 * Signed httpOnly cookie that stands in for the preview token after /p/<token> (Aria, section 3):
 * `<siteId>.<expiresAtMs>.<hmac>`. It keeps the token out of the address bar, history and
 * referrers. The site's validity is re-checked in the database on every request.
 * Same HMAC scheme as src/lib/auth/reset-cookie.ts, with its own secret label.
 */
export const PREVIEW_COOKIE_NAME = 'fp_outreach'
export const PREVIEW_COOKIE_MAX_AGE_SECONDS = 24 * 60 * 60
/**
 * Short pass issued with one "Send my details" (after the Turnstile check). It carries the new
 * submission's id so its photos (up to 50, each retryable on its own) can upload afterwards.
 */
export const FORM_PASS_COOKIE_NAME = 'fp_outreach_pass'
export const FORM_PASS_MAX_AGE_SECONDS = 30 * 60

function hmac(data: string, secret: string): string {
  return createHmac('sha256', secret).update(data).digest('base64url')
}

export function signSiteCookie(siteId: string, secret: string, maxAgeSeconds: number, now: number = Date.now()): string {
  const exp = now + maxAgeSeconds * 1000
  const payload = `${siteId}.${exp}`
  return `${payload}.${hmac(payload, secret)}`
}

/** Returns the site id when the value is authentic and unexpired, else null. */
export function verifySiteCookie(value: string | undefined | null, secret: string, now: number = Date.now()): string | null {
  if (!value || !secret) return null
  const parts = value.split('.')
  if (parts.length !== 3) return null
  const [siteId, expRaw, sig] = parts
  if (!/^[0-9a-f-]{36}$/.test(siteId)) return null
  const exp = Number(expRaw)
  if (!Number.isFinite(exp) || exp <= now) return null
  const expected = Buffer.from(hmac(`${siteId}.${expRaw}`, secret))
  const given = Buffer.from(sig)
  if (expected.length !== given.length || !timingSafeEqual(expected, given)) return null
  return siteId
}

/** 'claim': the one-time form token /claim puts in its POST to /claim/start (Vera r2 bug 9). */
export function outreachCookieSecret(label: 'preview' | 'pass' | 'claim'): string {
  const base = process.env.SUPABASE_SERVICE_ROLE_KEY?.trim()
  if (!base) return ''
  return createHash('sha256').update(`freeplug-outreach-${label}:v1:${base}`).digest('hex')
}

export function siteCookieOptions(maxAgeSeconds: number) {
  return {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax' as const,
    path: '/',
    maxAge: maxAgeSeconds,
  }
}
