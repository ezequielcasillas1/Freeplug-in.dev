import type { EmailOtpType } from '@supabase/supabase-js'

/**
 * Redirect targets after sign-in / email links. Only same-site relative paths are ever returned.
 *
 * safeNext() (login, /auth/callback, /auth/confirm): must start with a single `/` and, after up to three
 * rounds of URL-decoding, must not start with `//` or `/\`, contain a backslash, control character or
 * whitespace, or contain `://`; it must also resolve to the same origin. Anything else → the fallback.
 * Hardened in round 6 (Aria): the old check only refused a leading `//`.
 */
const DEFAULT_NEXT = '/dashboard'
const PROBE_ORIGIN = 'https://freeplug.invalid'

function isSafeRelativePath(raw: string): boolean {
  if (raw.length === 0 || raw.length > 512) return false
  let v = raw
  for (let round = 0; round < 4; round++) {
    if (!v.startsWith('/') || v.startsWith('//') || v.startsWith('/\\')) return false
    if (/[\\\s\u0000-\u001f\u007f]/.test(v) || v.includes('://')) return false
    let decoded: string
    try {
      decoded = decodeURIComponent(v)
    } catch {
      return false
    }
    if (decoded === v) break
    if (round === 3) return false // still decoding after three rounds: refuse
    v = decoded
  }
  try {
    return new URL(raw, PROBE_ORIGIN).origin === PROBE_ORIGIN
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
