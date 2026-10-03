/**
 * Is "Continue with Google" usable on this server? Asks Supabase Auth's public settings endpoint
 * (`/auth/v1/settings`, anon key only) whether the google provider is enabled. The local Docker stack
 * has Google off, and before this the button there led to GoTrue's raw JSON error
 * ("Unsupported provider: provider is not enabled").
 *
 * Fails OPEN: if the settings can't be read (network, timeout, odd JSON) the button stays, as before.
 * So on the hosted project (Google on) nothing changes. Cached for 5 minutes.
 */
export async function isGoogleSignInEnabled(
  opts: { url?: string; key?: string; fetchImpl?: typeof fetch; timeoutMs?: number } = {}
): Promise<boolean> {
  const url = (opts.url ?? process.env.NEXT_PUBLIC_SUPABASE_URL ?? '').replace(/\/+$/, '')
  const key = opts.key ?? process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? ''
  if (!url || !key) return true
  const doFetch = opts.fetchImpl ?? fetch
  try {
    const res = await doFetch(`${url}/auth/v1/settings`, {
      headers: { apikey: key },
      signal: AbortSignal.timeout(opts.timeoutMs ?? 2000),
      next: { revalidate: 300 },
    } as RequestInit)
    if (!res.ok) return true
    const body = (await res.json()) as { external?: Record<string, unknown> }
    return body?.external?.google !== false
  } catch {
    return true
  }
}

export const GOOGLE_DISABLED_MESSAGE =
  'Google sign-in is not set up on this server. Use your email and password.'
