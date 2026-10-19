import type { SupabaseClient } from '@supabase/supabase-js'
import { DEFAULT_LOCALE, type AppLocale } from './config'
import { effectiveLocale, spanishEnabled } from './gate'

/**
 * A customer's language from profiles.locale (card §3), for emails, Stripe and server actions.
 * Gate OFF -> 'en' WITHOUT querying, so a database that does not have the
 * 20261004120000_profiles_locale migration yet (hosted) is never asked for the column.
 * Any error or missing row -> 'en'.
 */
export async function readProfileLocale(
  client: Pick<SupabaseClient, 'from'>,
  userId: string | null | undefined,
  raw?: string
): Promise<AppLocale> {
  if (!spanishEnabled(raw) || !userId) return DEFAULT_LOCALE
  try {
    const { data, error } = await client.from('profiles').select('locale').eq('id', userId).maybeSingle()
    if (error) return DEFAULT_LOCALE
    const value = (data as { locale?: unknown } | null)?.locale
    return effectiveLocale(value === 'es' ? 'es' : 'en', raw)
  } catch {
    return DEFAULT_LOCALE
  }
}
