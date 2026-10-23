/**
 * Website request statuses (consultation card, Oct 22 2026). Flow:
 * submitted -> in_review -> consultation -> agreed -> building -> closed.
 * 'agreed' and 'building' need an agreed consultation (database trigger
 * website_requests_require_agreed_consultation); 'agreed' is normally set by the client's "Looks good".
 */
export const WEBSITE_REQUEST_STATUSES = ['submitted', 'in_review', 'consultation', 'agreed', 'building', 'closed'] as const
export type WebsiteRequestStatus = (typeof WEBSITE_REQUEST_STATUSES)[number]

/**
 * THE definition of "open" (Aria's ruling, Oct 22 r2): any status other than closed. Use this
 * constant (or isOpenRequestStatus) everywhere in TS. The SQL twin is
 * public.website_request_is_open() in migration 20261022200000; open-status-sync.test.ts fails if
 * they drift.
 */
export type OpenRequestStatus = Exclude<WebsiteRequestStatus, 'closed'>
export const OPEN_REQUEST_STATUSES: readonly OpenRequestStatus[] = WEBSITE_REQUEST_STATUSES.filter(
  (s): s is OpenRequestStatus => s !== 'closed'
)
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

/**
 * Intake: before the consultation step starts (the request form is still editable). NOT "open";
 * use OPEN_REQUEST_STATUSES for that.
 */
export const INTAKE_STATUSES = ['submitted', 'in_review'] as const
export type IntakeStatus = (typeof INTAKE_STATUSES)[number]
export function isIntakeStatus(status: string | null | undefined): status is IntakeStatus {
  return (INTAKE_STATUSES as readonly string[]).includes(status ?? '')
}

/**
 * Statuses a customer can close themselves (Aria's ruling on f36a910): open, except building. At
 * building the dashboard offers "Request to cancel" instead. SQL twin:
 * public.website_request_is_self_closable() (migration 20261022230000).
 */
export type SelfClosableStatus = Exclude<OpenRequestStatus, 'building'>
export const SELF_CLOSABLE_STATUSES: readonly SelfClosableStatus[] = OPEN_REQUEST_STATUSES.filter(
  (s): s is SelfClosableStatus => s !== 'building'
)
export function isSelfClosableStatus(status: string | null | undefined): status is SelfClosableStatus {
  return (SELF_CLOSABLE_STATUSES as readonly string[]).includes(status ?? '')
}
