/**
 * Customer-facing change-request status copy. Sable's final words (Oct 4 2026, 3:14 PM CT,
 * /workspace/copy/freeplug-guided-help-copy-2026-10-04.md "Change-request status labels").
 * One constant per string, each with its own i18n key. The Spanish lines are saved for the i18n
 * rebase in /workspace/owen/i18n-es-notes/rebase-todo.md ("change requests"), not shipped here.
 *
 * "Approved" never says or implies when a change goes live.
 */

/** changeRequests.heading */
export const CHANGE_REQUESTS_HEADING = 'Your change requests'
/** changeRequests.empty */
export const CHANGE_REQUESTS_EMPTY = "You haven't sent any change requests yet."
/** changeRequests.status.pendingReview */
export const CHANGE_REQUEST_STATUS_PENDING = "Received, we're working on it"
/** changeRequests.status.approved */
export const CHANGE_REQUEST_STATUS_APPROVED = 'Approved'
/** changeRequests.status.declined */
export const CHANGE_REQUEST_STATUS_DECLINED = 'Not approved'
/** changeRequests.declinedNote ({note} = the team's decision note) */
export function changeRequestDeclinedNote(note: string): string {
  return `Our note: ${note}`
}
/** changeRequests.declinedNoNote */
export const CHANGE_REQUEST_DECLINED_NO_NOTE = 'Questions? Email support@freeplug-in.dev.'

/** i18n key of every string above (for the rebase key list). */
export const CHANGE_REQUEST_COPY_KEYS = {
  heading: 'changeRequests.heading',
  empty: 'changeRequests.empty',
  pending: 'changeRequests.status.pendingReview',
  approved: 'changeRequests.status.approved',
  declined: 'changeRequests.status.declined',
  declinedNote: 'changeRequests.declinedNote',
  declinedNoNote: 'changeRequests.declinedNoNote',
} as const

export type ChangeRequestStatus = 'pending_review' | 'approved' | 'declined'

/** Status label + the line under it (declined only). Unknown statuses read as pending. */
export function customerStatusLines(status: string, decisionNote: string | null | undefined): { label: string; detail: string | null } {
  if (status === 'approved') return { label: CHANGE_REQUEST_STATUS_APPROVED, detail: null }
  if (status === 'declined') {
    const note = decisionNote?.trim()
    return { label: CHANGE_REQUEST_STATUS_DECLINED, detail: note ? changeRequestDeclinedNote(note) : CHANGE_REQUEST_DECLINED_NO_NOTE }
  }
  return { label: CHANGE_REQUEST_STATUS_PENDING, detail: null }
}
