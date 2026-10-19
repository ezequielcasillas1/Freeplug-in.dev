import { DEFAULT_LOCALE, INTL_LOCALE, type AppLocale } from './config'

/**
 * Locale-aware money and dates (card R3). Prices are always USD and never converted: es-US formats
 * $35.00 the same way. Every former hard-coded 'en-US' goes through here.
 */
export function intlLocale(locale: AppLocale = DEFAULT_LOCALE): string {
  return INTL_LOCALE[locale] ?? INTL_LOCALE.en
}

export const NBSP = '\u00A0'

/**
 * Lina's rule (Oct 4): a Spanish date never wraps, so EVERY space in it is U+00A0
 * ("9\u00A0de\u00A0octubre\u00A0de\u00A02026"). Applied once here so every Spanish date caller
 * gets it. English is left as Intl returns it on this branch (its NBSP pass lives on ladder-fix).
 */
export function noWrapDate(locale: AppLocale | undefined, text: string): string {
  return locale === 'es' ? text.replace(/\s/g, NBSP) : text
}

export function formatDateIn(
  locale: AppLocale | undefined,
  date: Date,
  options: Intl.DateTimeFormatOptions
): string {
  return noWrapDate(locale, new Intl.DateTimeFormat(intlLocale(locale), options).format(date))
}

/** USD for the dashboard: "$1,234" / "$35.00". Same symbol in every locale (card R3: never converted). */
export function formatUsdIn(locale: AppLocale | undefined, cents: number, fractionDigits: 0 | 2 = 2): string {
  return `$${formatNumberIn(locale, cents / 100, { minimumFractionDigits: fractionDigits, maximumFractionDigits: fractionDigits })}`
}

export function formatNumberIn(locale: AppLocale | undefined, value: number, options?: Intl.NumberFormatOptions): string {
  return new Intl.NumberFormat(intlLocale(locale), options).format(value)
}

/**
 * Lists ("$35, $55 or $65", "+1 small edit and Big change") through Intl.ListFormat (Aria, Oct 4),
 * so Spanish gets "y"/"o" (and Intl handles e/u). English uses the en-GB list style because the
 * house style has no serial comma; the words are identical to en-US.
 */
const LIST_LOCALE: Record<AppLocale, string> = { en: 'en-GB', es: 'es-US' }

export function formatList(
  items: readonly string[],
  locale: AppLocale = DEFAULT_LOCALE,
  type: 'conjunction' | 'disjunction' = 'conjunction'
): string {
  return new Intl.ListFormat(LIST_LOCALE[locale] ?? LIST_LOCALE.en, { style: 'long', type }).format(items)
}
