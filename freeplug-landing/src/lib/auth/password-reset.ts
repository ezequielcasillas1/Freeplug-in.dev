/** Shared password-reset constants and helpers (no server-only imports, safe to unit test). */

/** Must match the signup rule in `src/app/(auth)/actions.ts` (signUp). */
export const PASSWORD_MIN_LENGTH = 6

/** Shown for every reset request so the form never reveals which emails have accounts. */
export const RESET_NEUTRAL_MESSAGE = 'If an account exists for that email, we sent a reset link.'

/**
 * Link placed in our own reset email. `/auth/confirm` verifies the token hash server-side
 * (works in any browser, unlike the PKCE `?code=` flow) and then sends the user to /reset-password.
 */
export function recoveryConfirmUrl(baseUrl: string, tokenHash: string): string {
  const url = new URL('/auth/confirm', baseUrl)
  url.searchParams.set('token_hash', tokenHash)
  url.searchParams.set('type', 'recovery')
  url.searchParams.set('next', '/reset-password')
  return url.toString()
}

type Bucket = { count: number; windowStart: number }
const buckets = new Map<string, Bucket>()

/**
 * Tiny fixed-window limiter (in memory, per server instance). Returns true when the request
 * should be skipped. Not a substitute for an edge/WAF limit, but stops casual inbox flooding.
 */
export function hitLimit(key: string, max: number, windowMs: number, now: number = Date.now()): boolean {
  if (buckets.size > 5000) {
    for (const [k, b] of buckets) {
      if (now - b.windowStart >= windowMs) buckets.delete(k)
    }
  }
  const b = buckets.get(key)
  if (!b || now - b.windowStart >= windowMs) {
    buckets.set(key, { count: 1, windowStart: now })
    return false
  }
  b.count += 1
  return b.count > max
}

/** One reset email per address per minute. */
export function isResetThrottledForEmail(email: string, now: number = Date.now()): boolean {
  return hitLimit('reset-email:' + email.trim().toLowerCase(), 1, 60_000, now)
}

/** At most 5 reset requests per IP per 10 minutes. */
export function isResetThrottledForIp(ip: string, now: number = Date.now()): boolean {
  return hitLimit('reset-ip:' + ip, 5, 10 * 60_000, now)
}

type IdentityLike = { provider?: string | null }
type UserLike = {
  identities?: IdentityLike[] | null
  app_metadata?: { providers?: unknown; provider?: unknown } | null
}

/** True when the account has no email/password identity and signs in only with Google. */
export function isGoogleOnlyUser(user: UserLike | null | undefined): boolean {
  if (!user) return false
  const fromIdentities = (user.identities ?? []).map((i) => i.provider).filter(Boolean) as string[]
  const meta = user.app_metadata?.providers
  const fromMeta = Array.isArray(meta) ? meta.filter((p): p is string => typeof p === 'string') : []
  const providers = fromIdentities.length > 0 ? fromIdentities : fromMeta
  return providers.includes('google') && !providers.includes('email')
}
