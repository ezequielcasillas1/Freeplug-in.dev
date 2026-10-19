import 'server-only'
import { cookies } from 'next/headers'
import type { SupabaseClient } from '@supabase/supabase-js'
import { LOCALE_COOKIE, LOCALE_COOKIE_MAX_AGE, type AppLocale } from './config'
import { spanishEnabled } from './gate'
import { readProfileLocale } from './profile-locale'

/**
 * On sign-in, profiles.locale wins: the NEXT_LOCALE cookie is rewritten to the account's language so
 * the two always match (Aria, Oct 4: dashboard picker saved to profiles.locale). Gate OFF -> no-op.
 */
export async function syncLocaleCookieFromProfile(
  client: Pick<SupabaseClient, 'from'>,
  userId: string | null | undefined
): Promise<AppLocale | null> {
  if (!spanishEnabled() || !userId) return null
  const locale = await readProfileLocale(client, userId)
  const jar = await cookies()
  jar.set(LOCALE_COOKIE, locale, { path: '/', maxAge: LOCALE_COOKIE_MAX_AGE, sameSite: 'lax' })
  return locale
}
