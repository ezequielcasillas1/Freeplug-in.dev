import { createHash, createHmac, timingSafeEqual } from 'node:crypto'

/**
 * "This session came from a password-reset link" marker for /reset-password.
 *
 * Value: `<userId>.<expiresAtMs>.<hmac>` where hmac = HMAC-SHA256(`<userId>.<expiresAtMs>`).
 * The cookie is httpOnly, 15 minutes, sameSite=lax, secure in production. It is tied to the user
 * id, so it can't be reused for another account, and it can't be forged without the server secret.
 */

export const RESET_COOKIE_NAME = 'fp_pw_reset'
export const RESET_COOKIE_MAX_AGE_SECONDS = 15 * 60

function hmac(data: string, secret: string): string {
  return createHmac('sha256', secret).update(data).digest('base64url')
}

export function signResetToken(userId: string, secret: string, now: number = Date.now()): string {
  const exp = now + RESET_COOKIE_MAX_AGE_SECONDS * 1000
  const payload = `${userId}.${exp}`
  return `${payload}.${hmac(payload, secret)}`
}

export function verifyResetToken(
  value: string | undefined | null,
  userId: string | undefined | null,
  secret: string,
  now: number = Date.now()
): boolean {
  if (!value || !userId || !secret) return false
  const parts = value.split('.')
  if (parts.length !== 3) return false
  const [uid, expRaw, sig] = parts
  if (uid !== userId) return false
  const exp = Number(expRaw)
  if (!Number.isFinite(exp) || exp <= now) return false
  const expected = Buffer.from(hmac(`${uid}.${expRaw}`, secret))
  const given = Buffer.from(sig)
  return expected.length === given.length && timingSafeEqual(expected, given)
}

/**
 * Server secret for the HMAC, derived from the service-role key (server-only env, never sent to
 * the browser) so no new env var is needed. Empty string when unavailable → verification fails.
 */
export function resetCookieSecret(): string {
  const base = process.env.SUPABASE_SERVICE_ROLE_KEY?.trim()
  if (!base) return ''
  return createHash('sha256').update(`freeplug-reset-cookie:v1:${base}`).digest('hex')
}

export function resetCookieOptions() {
  return {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax' as const,
    path: '/',
    maxAge: RESET_COOKIE_MAX_AGE_SECONDS,
  }
}

/** True when a Supabase access token's `amr` claim says the session came from a recovery link. */
export function isRecoveryAccessToken(accessToken: string | undefined | null): boolean {
  if (!accessToken) return false
  const payload = accessToken.split('.')[1]
  if (!payload) return false
  try {
    const claims = JSON.parse(Buffer.from(payload, 'base64url').toString('utf8')) as {
      amr?: Array<{ method?: string }>
    }
    return Array.isArray(claims.amr) && claims.amr.some((a) => a?.method === 'recovery')
  } catch {
    return false
  }
}
