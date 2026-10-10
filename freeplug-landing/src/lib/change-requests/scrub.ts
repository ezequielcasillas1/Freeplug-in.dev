/**
 * Webhook scrub (Aria spec, item 3): before a change request leaves the app, emails, phone-number
 * patterns and 13-19 digit runs (card numbers, with or without spaces / dashes) become "[removed]".
 * Only the webhook payload is scrubbed; the stored row keeps what the customer typed.
 */
export const SCRUB_TOKEN = '[removed]'

/** Unicode-aware (Oct 10): "josé.ñandú@example.com" and IDN domains are emails too. */
const EMAIL = /[\p{L}\p{N}._%+-]+@[\p{L}\p{N}-]+(?:\.[\p{L}\p{N}-]+)*\.[\p{L}]{2,}/giu
/**
 * A run that starts with a digit, "+" or "(" and continues with digits joined by at most two of
 * space . - ( ). Digits are counted afterwards: 13-19 is a card-like run, 7-12 a phone number.
 */
const DIGIT_RUN = /(?<![\w+])\+?(?:\(\d{1,4}\)|\d)(?:[ .\-()]{0,2}\d)+(?![\w])/g
/** ISO dates and times are not phone numbers ("2026-10-04"). */
const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/

function scrubDigits(run: string): string {
  if (ISO_DATE.test(run)) return run
  const digits = run.replace(/\D/g, '').length
  if (digits >= 13 && digits <= 19) return SCRUB_TOKEN
  if (digits >= 7 && digits <= 12) return SCRUB_TOKEN
  if (digits > 19) return SCRUB_TOKEN
  return run
}

export function scrubForWebhook(text: string): string {
  return text.replace(EMAIL, SCRUB_TOKEN).replace(DIGIT_RUN, scrubDigits)
}
