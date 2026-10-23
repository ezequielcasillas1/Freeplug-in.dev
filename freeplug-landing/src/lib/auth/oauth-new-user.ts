/**
 * Sign-ups paused (Cheke, Oct 23, 2026): "Continue with Google" must not create new accounts.
 * Supabase creates the auth user during the OAuth exchange, so the callback detects a user
 * created within this sign-in and signs them out (nothing is deleted).
 */
export const NEW_OAUTH_USER_WINDOW_MS = 10 * 60_000

type MinimalUser = {
  created_at?: string | null
  app_metadata?: { provider?: string | null; providers?: string[] | null } | null
}

export function isNewOAuthSignup(user: MinimalUser | null | undefined, now = Date.now()): boolean {
  if (!user?.created_at) return false
  const providers = [user.app_metadata?.provider, ...(user.app_metadata?.providers ?? [])]
  if (!providers.includes('google')) return false
  const created = Date.parse(user.created_at)
  if (Number.isNaN(created)) return false
  return now - created < NEW_OAUTH_USER_WINDOW_MS
}
