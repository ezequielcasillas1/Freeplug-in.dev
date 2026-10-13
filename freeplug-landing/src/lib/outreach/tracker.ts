import { TRACKER_ORGANIC_STEPS, TRACKER_OUTREACH_STEPS } from './copy'

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
}): TrackerStep[] {
  return build(TRACKER_OUTREACH_STEPS, [true, s.claimed, s.detailsConfirmed, s.hostingSetUp, s.live])
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
}): TrackerStep[] {
  return build(TRACKER_ORGANIC_STEPS, [
    s.hasRequest,
    s.building || s.hostingSetUp,
    s.hostingSetUp,
    s.hostingSetUp,
    s.live,
  ])
}
