import 'server-only'
import { cache } from 'react'
import { cookies } from 'next/headers'
import { createClient } from '@/lib/supabase/server'
import { DEFAULT_LOCALE, LOCALE_COOKIE, toAppLocale, type AppLocale } from './config'
import { effectiveLocale, spanishEnabled } from './gate'

/**
 * Locale for unprefixed app pages (dashboard, login, claim, auth): profiles.locale for a signed-in
 * customer, else the NEXT_LOCALE cookie, else English (card R3/R4). Gate OFF -> always English and
 * nothing is read. One lookup per request (React cache).
 */
export const resolveAppLocale = cache(async (): Promise<AppLocale> => {
  if (!spanishEnabled()) return DEFAULT_LOCALE
  const stored = await profileLocaleForCurrentUser()
  if (stored) return effectiveLocale(stored)
  const jar = await cookies()
  return effectiveLocale(toAppLocale(jar.get(LOCALE_COOKIE)?.value))
})

async function profileLocaleForCurrentUser(): Promise<AppLocale | null> {
  try {
    const supabase = await createClient()
    const {
      data: { user },
    } = await supabase.auth.getUser()
    if (!user) return null
    const { data } = await supabase.from('profiles').select('locale').eq('id', user.id).maybeSingle()
    const value = (data as { locale?: unknown } | null)?.locale
    return value === 'es' || value === 'en' ? value : null
  } catch {
    // No Supabase env (static build) or the column is not migrated yet: fall back to the cookie.
    return null
  }
}
