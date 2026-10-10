'use server'

import { cookies } from 'next/headers'
import { createClient } from '@/lib/supabase/server'
import { getStripe } from '@/lib/stripe/server'
import { syncCustomerPreferredLocales } from '@/lib/stripe/locale'
import { isAppLocale, LOCALE_COOKIE, LOCALE_COOKIE_MAX_AGE, type AppLocale } from '@/i18n/config'
import { spanishEnabled } from '@/i18n/gate'

export type SaveLocaleResult = { ok: true; locale: AppLocale; savedToAccount: boolean } | { ok: false; code: 'gate_off' | 'bad_locale' | 'save_failed' }

/**
 * Language picker (card R4, §0b). Sets the NEXT_LOCALE cookie (1 year, SameSite=Lax). When
 * signed in, also saves profiles.locale through the owner-only RPC set_own_locale (it writes only
 * auth.uid()'s row, so nobody can set another user's language), mirrors it to Supabase user
 * metadata `locale` (Supabase Auth email templates branch on .Data.locale, card R6) and to the
 * Stripe customer's preferred_locales (receipts, R7). The last two are best effort.
 * Gate OFF -> refused, nothing written.
 */
export async function saveLocalePreference(locale: unknown): Promise<SaveLocaleResult> {
  if (!spanishEnabled()) return { ok: false, code: 'gate_off' }
  if (!isAppLocale(locale)) return { ok: false, code: 'bad_locale' }

  // Signed in: profiles.locale is written first and the cookie only follows a successful save, so
  // the cookie and the account never disagree (Oct 10). Signed out: cookie only.
  let savedToAccount = false
  try {
    const supabase = await createClient()
    const {
      data: { user },
    } = await supabase.auth.getUser()
    if (user) {
      const { error } = await supabase.rpc('set_own_locale', { p_locale: locale })
      if (error) {
        console.error('[language] set_own_locale failed', error.message)
        return { ok: false, code: 'save_failed' }
      }
      savedToAccount = true
      try {
        const meta = await supabase.auth.updateUser({ data: { locale } })
        if (meta.error) console.error('[language] user metadata update failed', meta.error.message)
        const { data: prof } = await supabase.from('profiles').select('stripe_customer_id').eq('id', user.id).maybeSingle()
        const customerId = (prof as { stripe_customer_id?: string | null } | null)?.stripe_customer_id
        if (customerId) await syncCustomerPreferredLocales(getStripe(), customerId, locale)
      } catch (e) {
        console.error('[language] best-effort mirrors failed', e instanceof Error ? e.message : e)
      }
    }
  } catch (e) {
    console.error('[language] could not save to the account', e instanceof Error ? e.message : e)
  }

  const jar = await cookies()
  jar.set(LOCALE_COOKIE, locale, { path: '/', maxAge: LOCALE_COOKIE_MAX_AGE, sameSite: 'lax' })
  return { ok: true, locale, savedToAccount }
}
