import { createHash, randomBytes } from 'node:crypto'

/**
 * Preview link tokens (Aria, section 3): 32 random bytes, base64url (43 chars). Only the SHA-256
 * (hex) is stored; lookups are by exact hash, so a changed character can't open another row.
 */
export const TOKEN_BYTES = 32
export const LINK_LIFETIME_DAYS = 30

export function generatePreviewToken(): { token: string; tokenHash: string } {
  const token = randomBytes(TOKEN_BYTES).toString('base64url')
  return { token, tokenHash: hashPreviewToken(token) }
}

export function hashPreviewToken(token: string): string {
  return createHash('sha256').update(token, 'utf8').digest('hex')
}

/** Cheap shape check before touching the database (43 base64url chars). */
export function isWellFormedToken(token: unknown): token is string {
  return typeof token === 'string' && /^[A-Za-z0-9_-]{43}$/.test(token)
}

export function linkExpiryFrom(now: Date = new Date(), days: number = LINK_LIFETIME_DAYS): Date {
  return new Date(now.getTime() + days * 86_400_000)
}

/** "Extend 30 days": from the later of now and the current expiry. */
export function extendedExpiry(current: Date, now: Date = new Date()): Date {
  return linkExpiryFrom(current > now ? current : now)
}

/** Every invalid state (unknown, expired, revoked, claimed) is the same "not valid". */
export function isLinkUsable(
  site: { expires_at: string; revoked_at: string | null; claimed_by: string | null } | null,
  now: Date = new Date()
): boolean {
  if (!site) return false
  if (site.revoked_at || site.claimed_by) return false
  return new Date(site.expires_at).getTime() > now.getTime()
}
