import type { Entitlements } from './ladder'

/**
 * Response-time promise (Cheke, Oct 19 2026 10:20 AM CT). Same plan logic as Priority: the plan STEP rank
 * (src/lib/plans/ladder.ts), never dollar strings or what a customer pays in total (a tip never counts).
 * Starter ($35) or no active plan: business days only. Priority ($55) and every step above it
 * (grandfathered plans by their bought hosting + add-on, as entitlementsFor({ legacy }) ranks them):
 * business days and weekends.
 */
export function hasWeekendReplies(ent: Pick<Entitlements, 'step' | 'priorityRank'> | null | undefined): boolean {
  return Boolean(ent?.step) && (ent?.priorityRank ?? -1) >= 1
}

/** Catalog key (common.support.*) for the dashboard SupportCard line. */
export function responseDaysKey(weekendReplies: boolean): 'respondWeekends' | 'respondWeekdays' {
  return weekendReplies ? 'respondWeekends' : 'respondWeekdays'
}

/** Admin-only badge text (customers table) and filter label. */
export const WEEKEND_REPLIES_ADMIN_BADGE = 'Weekend replies'
