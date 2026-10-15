/**
 * Lina (Oct 13): the phone sticky bar wraps, but an amount ("$15.00", "$1,234.56", "1.234,56 US$") or a
 * date ("Nov 3", "3 de nov. de 2026") must never be split across lines. Every space inside the formatted
 * value (including the narrow no-break/thin spaces some locales emit) becomes U+00A0, so it works for any
 * locale. Applied in the formatting helpers, never to catalog strings.
 */
export const NBSP = '\u00a0'

export function keepTogether(formatted: string): string {
  return formatted.replace(/\s/g, NBSP)
}

/** "$35" / "$12.34" (cents only when not whole), kept together. */
export function formatAmount(cents: number): string {
  return keepTogether(`$${(cents / 100).toFixed(cents % 100 === 0 ? 0 : 2)}`)
}

/** "$12.34", always with cents, kept together. */
export function formatAmountCents(cents: number): string {
  return keepTogether(`$${(cents / 100).toFixed(2)}`)
}

/** A date string from any locale's formatter, kept on one line. */
export function keepDateTogether(date: string): string {
  return keepTogether(date)
}
