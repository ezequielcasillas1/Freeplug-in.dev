/**
 * Freeplug languages (Aria's translation card v4, Oct 4 2026): English + Spanish only, for now.
 * Adding a language later = add its code here, add messages/<code>.json, widen the profiles.locale
 * check constraint, and run the review chain (card §0). Right-to-left and non-Latin scripts are out
 * of scope (layout pass + fonts needed).
 */
export const LOCALES = ['en', 'es'] as const
export type AppLocale = (typeof LOCALES)[number]
export const DEFAULT_LOCALE: AppLocale = 'en'

/** Functional cookie (card R4): 1 year, SameSite=Lax. Set by the switcher/banner, never by detection. */
export const LOCALE_COOKIE = 'NEXT_LOCALE'
export const LOCALE_COOKIE_MAX_AGE = 60 * 60 * 24 * 365

/** Switcher labels, each in its own language (card R4). No flags. */
export const LOCALE_LABELS: Record<AppLocale, string> = { en: 'English', es: 'Español' }

/** Intl locale per app locale (card R3: es-US style, prices stay USD). */
export const INTL_LOCALE: Record<AppLocale, string> = { en: 'en-US', es: 'es-US' }

/** Stripe Checkout / portal locale (card R7): `es` is Spain, `es-419` is Latin American Spanish. */
export const STRIPE_LOCALE: Record<AppLocale, 'en' | 'es-419'> = { en: 'en', es: 'es-419' }

export function isAppLocale(value: unknown): value is AppLocale {
  return typeof value === 'string' && (LOCALES as readonly string[]).includes(value)
}

/** Any stored/cookie value to a supported locale; unknown or missing -> English. */
export function toAppLocale(value: unknown): AppLocale {
  return isAppLocale(value) ? value : DEFAULT_LOCALE
}
