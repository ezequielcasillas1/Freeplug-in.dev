import { TRACKER_ORGANIC_STEPS, TRACKER_OUTREACH_STEPS } from './copy'
import { DEFAULT_LOCALE, type AppLocale } from '@/i18n/config'
import { translatorFor } from '@/i18n/translate'

const OUTREACH_KEYS = ['built', 'yourReview', 'detailsConfirmed', 'hostingSetUp', 'live'] as const
const ORGANIC_KEYS = ['requestSent', 'consultation', 'building', 'yourReview', 'hostingSetUp', 'live'] as const

/** Step labels in a language (claim.tracker*Steps); English stays the copy.ts constants. */
function labelsFor(locale: AppLocale, kind: 'outreach' | 'organic'): readonly string[] {
  if (locale === DEFAULT_LOCALE) return kind === 'outreach' ? TRACKER_OUTREACH_STEPS : TRACKER_ORGANIC_STEPS
  const t = translatorFor(locale, kind === 'outreach' ? 'claim.trackerOutreachSteps' : 'claim.trackerOrganicSteps')
  return (kind === 'outreach' ? OUTREACH_KEYS : ORGANIC_KEYS).map((k) => t(k))
}

export type TrackerStepState = 'done' | 'current' | 'todo'
/** href: optional link (the Consultation step links to the choice page while it is not done). */
export type TrackerStep = { label: string; state: TrackerStepState; href?: string }

export const CONSULTATION_STEP_HREF = '/dashboard/consultation'

function build(labels: readonly string[], done: boolean[]): TrackerStep[] {
  const firstOpen = done.findIndex((d) => !d)
  return labels.map((label, i) => ({
    label,
    state: done[i] ? 'done' : i === firstOpen ? 'current' : 'todo',
  }))
}

/**
 * Outreach customers (Aria section 9 mapping): Built is always done; Your review = claimed;
 * Details confirmed = the customer confirmed step 2; Hosting set up = card saved (setup-mode
 * Checkout); Live = admin published and the first invoice was paid.
 */
export function outreachTracker(s: {
  claimed: boolean
  detailsConfirmed: boolean
  hostingSetUp: boolean
  live: boolean
}, locale: AppLocale = DEFAULT_LOCALE): TrackerStep[] {
  return build(labelsFor(locale, 'outreach'), [true, s.claimed, s.detailsConfirmed, s.hostingSetUp, s.live])
}

/**
 * Organic customers (Lina's label set). There is no stored "your review" step for organic
 * requests, so it counts as done once hosting is set up (the customer reviewed and chose a plan).
 * Consultation (Oct 23): done once the client filled the detailed form (sent it for review),
 * booked a live session, or agreed the summary; current right after the request is sent.
 * Building = the plan is agreed (status agreed/building) — it can't start before the consultation.
 */
export function organicTracker(s: {
  hasRequest: boolean
  consultationDone: boolean
  building: boolean
  hostingSetUp: boolean
  live: boolean
}, locale: AppLocale = DEFAULT_LOCALE): TrackerStep[] {
  const consultationDone = s.consultationDone || s.building || s.hostingSetUp
  const steps = build(labelsFor(locale, 'organic'), [
    s.hasRequest,
    consultationDone,
    s.building || s.hostingSetUp,
    s.hostingSetUp,
    s.hostingSetUp,
    s.live,
  ])
  if (s.hasRequest && !consultationDone) steps[1] = { ...steps[1], href: CONSULTATION_STEP_HREF }
  return steps
}

/** Consultation counts as done: form sent for review, live session booked, or summary agreed. */
export function isConsultationDone(
  stage: 'choose' | 'form_draft' | 'live_booking' | 'live_waiting' | 'review' | 'agreed' | null,
  requestStatus: string | null | undefined
): boolean {
  if (requestStatus === 'agreed' || requestStatus === 'building') return true
  return stage === 'live_waiting' || stage === 'review' || stage === 'agreed'
}
