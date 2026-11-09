import { DEFAULT_LOCALE, type AppLocale } from './config'

/**
 * Feature gate for the Spanish build. OFF by default (card §9). Only the exact value "on" turns it
 * on. The value is read literally so Next inlines it in client bundles too (build-time switch).
 *
 * Gate OFF = no /es routes, no hreflang/alternates, no switcher, no banner, English everywhere
 * (dashboard, emails, Stripe locale), whatever profiles.locale or the cookie says.
 */
export const SPANISH_GATE_VALUE = process.env.NEXT_PUBLIC_FREEPLUG_I18N_ES

export function spanishEnabled(raw: string | undefined = SPANISH_GATE_VALUE): boolean {
  return raw === 'on'
}

/** Locales that have routes and can be chosen right now. */
export function enabledLocales(raw?: string): AppLocale[] {
  return spanishEnabled(raw ?? SPANISH_GATE_VALUE) ? ['en', 'es'] : ['en']
}

/** The locale actually used for a stored preference: the gate wins over the preference. */
export function effectiveLocale(preferred: AppLocale | null | undefined, raw?: string): AppLocale {
  if (!spanishEnabled(raw ?? SPANISH_GATE_VALUE)) return DEFAULT_LOCALE
  return preferred === 'es' ? 'es' : DEFAULT_LOCALE
}

/**
 * LOCAL QA ONLY: lets the gate run while Sable's es.json is still pending, with every missing
 * Spanish string falling back to English (optionally marked). Never set this on a hosted build;
 * scripts/cf-upload-guard.mjs refuses an upload while it is set.
 */
export function allowPendingSpanish(env: Record<string, string | undefined> = process.env): boolean {
  return env.FREEPLUG_I18N_ES_ALLOW_PENDING === '1'
}

/** LOCAL QA ONLY: prefix pending (English fallback) strings with "[pending Sable] " so they stand out. */
export function markPendingSpanish(env: Record<string, string | undefined> = process.env): boolean {
  return env.FREEPLUG_I18N_ES_PENDING_MARK === '1'
}
