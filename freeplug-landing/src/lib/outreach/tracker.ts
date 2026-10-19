import { TRACKER_ORGANIC_STEPS, TRACKER_OUTREACH_STEPS } from './copy'
import { DEFAULT_LOCALE, type AppLocale } from '@/i18n/config'
import { translatorFor } from '@/i18n/translate'

const OUTREACH_KEYS = ['built', 'yourReview', 'detailsConfirmed', 'hostingSetUp', 'live'] as const
const ORGANIC_KEYS = ['requestSent', 'building', 'yourReview', 'hostingSetUp', 'live'] as const

/** Step labels in a language (claim.tracker*Steps); English stays the copy.ts constants. */
function labelsFor(locale: AppLocale, kind: 'outreach' | 'organic'): readonly string[] {
  if (locale === DEFAULT_LOCALE) return kind === 'outreach' ? TRACKER_OUTREACH_STEPS : TRACKER_ORGANIC_STEPS
  const t = translatorFor(locale, kind === 'outreach' ? 'claim.trackerOutreachSteps' : 'claim.trackerOrganicSteps')
  return (kind === 'outreach' ? OUTREACH_KEYS : ORGANIC_KEYS).map((k) => t(k))
}

export type TrackerStepState = 'done' | 'current' | 'todo'
export type TrackerStep = { label: string; state: TrackerStepState }

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
 * Building = the team moved the request to in review (or later).
 */
export function organicTracker(s: {
  hasRequest: boolean
  building: boolean
  hostingSetUp: boolean
  live: boolean
}, locale: AppLocale = DEFAULT_LOCALE): TrackerStep[] {
  return build(labelsFor(locale, 'organic'), [
    s.hasRequest,
    s.building || s.hostingSetUp,
    s.hostingSetUp,
    s.hostingSetUp,
    s.live,
  ])
}
