/**
 * Website request statuses (consultation card, Oct 22 2026). Flow:
 * submitted -> in_review -> consultation -> agreed -> building -> closed.
 * 'agreed' and 'building' need an agreed consultation (database trigger
 * website_requests_require_agreed_consultation); 'agreed' is normally set by the client's "Looks good".
 */
export const WEBSITE_REQUEST_STATUSES = ['submitted', 'in_review', 'consultation', 'agreed', 'building', 'closed'] as const
export type WebsiteRequestStatus = (typeof WEBSITE_REQUEST_STATUSES)[number]

/** Statuses that count as the customer's one open request. */
export const OPEN_REQUEST_STATUSES = ['submitted', 'in_review', 'consultation', 'agreed', 'building'] as const
/** Before "Looks good": the client can still pick or change a consultation path. */
export const PRE_AGREEMENT_STATUSES = ['submitted', 'in_review', 'consultation'] as const

export const STATUS_LABELS: Record<WebsiteRequestStatus, string> = {
  submitted: 'Submitted',
  in_review: 'In review',
  consultation: 'Consultation',
  agreed: 'Agreed',
  building: 'Building',
  closed: 'Closed',
}

export function isWebsiteRequestStatus(v: unknown): v is WebsiteRequestStatus {
  return typeof v === 'string' && (WEBSITE_REQUEST_STATUSES as readonly string[]).includes(v)
}

export function isPreAgreement(status: string | null | undefined): boolean {
  return !!status && (PRE_AGREEMENT_STATUSES as readonly string[]).includes(status)
}

/** Building, charges or a domain purchase may start only after "Looks good". */
export function canStartBuild(c: { agreed_at: string | null } | null | undefined): boolean {
  return !!c?.agreed_at
}

/** Where the client is in the consultation (drives the dashboard card and pages). */
export type ConsultationStage = 'choose' | 'form_draft' | 'live_booking' | 'live_waiting' | 'review' | 'agreed'

export function consultationStage(
  c:
    | {
        path: 'form' | 'live'
        booked_at: string | null
        booking_ref: string | null
        ready_for_review_at: string | null
        agreed_at: string | null
      }
    | null
    | undefined
): ConsultationStage {
  if (!c) return 'choose'
  if (c.agreed_at) return 'agreed'
  if (c.ready_for_review_at) return 'review'
  if (c.path === 'form') return 'form_draft'
  return c.booked_at || c.booking_ref ? 'live_waiting' : 'live_booking'
}

/** Open = any status except closed (the one-open-request-per-user set). */
export function isOpenRequestStatus(status: string | null | undefined): boolean {
  return (OPEN_REQUEST_STATUSES as readonly string[]).includes(status ?? '')
}
