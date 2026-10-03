import { createClient as createSupabaseClient } from '@supabase/supabase-js'

/**
 * Anon Supabase client with no cookies or session: safe in background work (ctx.waitUntil) after the
 * response is gone. Used for the password-reset fallback (resetPasswordForEmail). Because no PKCE code
 * verifier cookie can be set from there, the hosted "Reset password" email template must link to
 * /auth/confirm?token_hash={{ .TokenHash }}&type=recovery&next=/reset-password (see CF-PORT-NOTES).
 */
export function createAnonClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
  if (!url || !key) throw new Error('Missing NEXT_PUBLIC_SUPABASE_URL or NEXT_PUBLIC_SUPABASE_ANON_KEY')
  return createSupabaseClient(url, key, {
    auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false, flowType: 'implicit' },
  })
}
