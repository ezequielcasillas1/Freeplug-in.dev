import type { EmailOtpType } from '@supabase/supabase-js'

/**
 * Redirect targets after sign-in / email links. Only same-site relative paths are ever returned.
 *
 * safeNext() (login, /auth/callback, /auth/confirm) is an allowlist (base QA, replaces the round-6 denylist):
 * the value is URL-decoded exactly once (a malformed escape is refused), and then the decoded value must
 *   - start with exactly one `/` (never `//`),
 *   - use only path/query characters: letters, digits and `- . _ ~ / ? = & # + ,` (so no `\`, `%`, `:`,
 *     whitespace, control characters or any `scheme:`),
 *   - not contain `..` anywhere.
 * The raw value must not contain an encoded `/` or `\` (`%2f` / `%5c`, any case), and the result must resolve
 * to our own origin. Anything else → the fallback (/dashboard by default).
 */
const DEFAULT_NEXT = '/dashboard'
const PROBE_ORIGIN = 'https://freeplug.invalid'
const ALLOWED_PATH = /^\/[A-Za-z0-9\-._~/?=&#+,]*$/

function isSafeRelativePath(raw: string): boolean {
  if (raw.length === 0 || raw.length > 512) return false
  if (/%(2f|5c)/i.test(raw)) return false
  if (/[\u0000-\u001f\u007f]/.test(raw)) return false
  let decoded: string
  try {
    decoded = decodeURIComponent(raw)
  } catch {
    return false
  }
  if (!ALLOWED_PATH.test(decoded)) return false
  if (decoded.startsWith('//') || decoded.includes('..')) return false
  try {
    return new URL(decoded, PROBE_ORIGIN).origin === PROBE_ORIGIN
  } catch {
    return false
  }
}

export function safeNext(next: string | null | undefined, fallback: string = DEFAULT_NEXT): string {
  return typeof next === 'string' && isSafeRelativePath(next) ? next : fallback
}

/**
 * /auth/confirm (token-hash email links): only these OTP types, matching the link lines in
 * SUPABASE-AUTH-CHECKLIST.md and our own reset email. `email` covers sign-up confirmation and magic links
 * (Supabase's non-deprecated type for both); `signup` / `magiclink` aren't used by any link we send.
 */
export const CONFIRM_OTP_TYPES = ['recovery', 'email', 'invite', 'email_change'] as const satisfies readonly EmailOtpType[]
export type ConfirmOtpType = (typeof CONFIRM_OTP_TYPES)[number]

export function confirmOtpType(raw: string | null | undefined): ConfirmOtpType | null {
  return (CONFIRM_OTP_TYPES as readonly string[]).includes(raw ?? '') ? (raw as ConfirmOtpType) : null
}

/** Where each type may continue to (exact paths, no query or fragment). The first entry is the default. */
export const CONFIRM_NEXT_ALLOWLIST: Record<ConfirmOtpType, readonly string[]> = {
  recovery: ['/reset-password'],
  email: ['/dashboard', '/claim'],
  invite: ['/dashboard'],
  email_change: ['/dashboard'],
}

export function confirmNext(type: ConfirmOtpType, raw: string | null | undefined): string {
  const allowed = CONFIRM_NEXT_ALLOWLIST[type]
  const candidate = safeNext(raw, '')
  return allowed.includes(candidate) ? candidate : allowed[0]
}
