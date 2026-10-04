/** Business time zone for customer-facing note dates (Freeplug runs on Central time). */
export const NOTE_DATE_TIME_ZONE = 'America/Chicago'

const yearIn = (d: Date) => Number(new Intl.DateTimeFormat('en-US', { year: 'numeric', timeZone: NOTE_DATE_TIME_ZONE }).format(d))

/**
 * Lina 10:33: the small date line on a refund note card: "Oct 4", or "Dec 30, 2025" when it isn't the
 * current year, both read in America/Chicago (a refund at 11 PM CT on Oct 4 is "Oct 4", not Oct 5 UTC).
 */
export function formatNoteDate(date: Date, now: Date = new Date()): string {
  return date.toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    ...(yearIn(date) === yearIn(now) ? {} : { year: 'numeric' as const }),
    timeZone: NOTE_DATE_TIME_ZONE,
  })
}
