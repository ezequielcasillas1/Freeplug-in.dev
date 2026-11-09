/**
 * Sign-ups paused (Cheke, Oct 23-24, 2026): the auth callback (Google / email link) must not let a
 * new account in. Supabase creates the auth user during the exchange, so the callback signs out any
 * user whose auth created_at is on or after the cutoff, or who has no profiles row (nothing is
 * deleted). Accounts created before the cutoff sign in as before.
 *
 * Cutoff: SIGNUP_BLOCK_CUTOFF (ISO 8601, server env), default 2026-10-22T00:00:00-05:00.
 */
export const DEFAULT_SIGNUP_BLOCK_CUTOFF = '2026-10-22T00:00:00-05:00'

export function signupBlockCutoffMs(raw: string | undefined = process.env.SIGNUP_BLOCK_CUTOFF): number {
  const parsed = raw?.trim() ? Date.parse(raw.trim()) : NaN
  return Number.isNaN(parsed) ? Date.parse(DEFAULT_SIGNUP_BLOCK_CUTOFF) : parsed
}

type MinimalUser = {
  created_at?: string | null
}

/** True when the user was created on/after the cutoff. Unparsable created_at counts as new (fail closed). */
export function isPostCutoffUser(user: MinimalUser | null | undefined, cutoffMs = signupBlockCutoffMs()): boolean {
  if (!user) return false
  const created = Date.parse(user.created_at ?? '')
  if (Number.isNaN(created)) return true
  return created >= cutoffMs
}

/**
 * hasProfile: true / false from a successful profiles lookup, or null when the lookup failed
 * (a failed lookup never blocks an existing user on its own).
 */
export function shouldBlockSignIn(
  user: MinimalUser | null | undefined,
  hasProfile: boolean | null,
  cutoffMs = signupBlockCutoffMs()
): boolean {
  if (!user) return false
  return isPostCutoffUser(user, cutoffMs) || hasProfile === false
}
