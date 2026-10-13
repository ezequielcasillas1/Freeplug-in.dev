/**
 * Help-chat submit lines for the change_requests caps and failures (Aria rulings 7 + 8, Oct 4 3:51 PM CT).
 * INTERIM (Sable has no final lines for these yet; /workspace/copy has none as of Oct 10). One key each.
 */

/** changeRequests.error.pendingCap */
export const CHANGE_REQUEST_PENDING_CAP =
  'You already have 10 change requests waiting for review. Please wait until we review some, or email support@freeplug-in.dev.'
/** changeRequests.error.dailyCap */
export const CHANGE_REQUEST_DAILY_CAP =
  "You've sent 20 change requests in the last 24 hours. Please try again tomorrow, or email support@freeplug-in.dev."
/** changeRequests.error.tooLong (same limit as the form: 2,000 characters) */
export const CHANGE_REQUEST_TOO_LONG = 'Please keep your request under 2,000 characters.'
/** Catalog key for CHANGE_REQUEST_TOO_LONG (en = the line above; es: Sable 10-13). */
export const CHANGE_REQUEST_TOO_LONG_KEY = 'errors.request.description.tooLong'
/** changeRequests.error.notSaved (row and notes both failed; Aria's words, ruling 7) */
export const CHANGE_REQUEST_NOT_SAVED = "Please try again, or email support@freeplug-in.dev and we'll help."

export const CHANGE_REQUEST_SUBMIT_KEYS = {
  pendingCap: 'changeRequests.error.pendingCap',
  dailyCap: 'changeRequests.error.dailyCap',
  tooLong: 'changeRequests.error.tooLong',
  notSaved: 'changeRequests.error.notSaved',
} as const

export const DESCRIPTION_MAX = 2000

type PgErr = { code?: string | null; message?: string | null; details?: string | null } | null | undefined

/**
 * A change_requests insert error the customer should see (cap or length), or null when it is
 * any other failure (then the notes append is the fallback and the admin is alerted).
 */
export function friendlyInsertError(err: PgErr): string | null {
  if (!err) return null
  const text = `${err.message ?? ''} ${err.details ?? ''}`
  if (text.includes('change_requests_pending_cap')) return CHANGE_REQUEST_PENDING_CAP
  if (text.includes('change_requests_daily_cap')) return CHANGE_REQUEST_DAILY_CAP
  if (err.code === '23514' && text.includes('change_requests_description_check')) return CHANGE_REQUEST_TOO_LONG
  return null
}
