import type Stripe from 'stripe'
import { STRIPE_LOCALE, type AppLocale } from '@/i18n/config'
import { spanishEnabled } from '@/i18n/gate'

/**
 * Stripe language (card R7). Gate OFF -> nothing is added, so Stripe keeps today's behavior
 * (browser locale) and request params are byte-for-byte unchanged. Gate ON -> 'en' or 'es-419'
 * (Latin American Spanish; Stripe's 'es' is Spain). Product and price names stay English (C5).
 */
export function stripeLocaleParam(locale: AppLocale, raw?: string): { locale?: 'en' | 'es-419' } {
  if (!spanishEnabled(raw)) return {}
  return { locale: STRIPE_LOCALE[locale] ?? 'en' }
}

/** Customer preferred_locales (receipts, invoice emails/PDFs). Gate OFF -> undefined (no change). */
export function preferredLocalesFor(locale: AppLocale, raw?: string): string[] | undefined {
  if (!spanishEnabled(raw)) return undefined
  return [STRIPE_LOCALE[locale] ?? 'en']
}

/** Part of an idempotency key: '' with the gate off (keys unchanged), else ':<stripe locale>'. */
export function localeKeyPart(locale: AppLocale, raw?: string): string {
  const p = stripeLocaleParam(locale, raw).locale
  return p ? `:${p}` : ''
}

/**
 * Sets the customer's preferred_locales (at create and on a language switch). Best effort: a
 * failure is logged and never blocks checkout or the switch. No call at all with the gate off.
 */
export async function syncCustomerPreferredLocales(
  stripe: Pick<Stripe, 'customers'>,
  customerId: string | null | undefined,
  locale: AppLocale,
  raw?: string
): Promise<boolean> {
  const preferred = preferredLocalesFor(locale, raw)
  if (!preferred || !customerId) return false
  try {
    await stripe.customers.update(customerId, { preferred_locales: preferred })
    return true
  } catch (e) {
    console.error('[stripe/locale] preferred_locales update failed', e instanceof Error ? e.message : e)
    return false
  }
}
