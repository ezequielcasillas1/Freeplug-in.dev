import { stepById } from './ladder'

/**
 * Priority comes from the plan STEP (src/lib/plans/ladder.ts: rank >= the Priority step), never from
 * what a customer pays in total. The old "monthly total >= $55" helpers (qualifiesForPriority,
 * priorityRankForMonthlyCents, planMonthlyTotalCents, getPlanMonthlyTotalCents) are gone (tipping
 * system, Oct 3): a tip must never buy Priority. Grandfathered slider/add-on plans keep the Sep 25
 * rule inside entitlementsFor({ legacy }) only, computed from the plan they bought (hosting price +
 * add-on); a tip item is never part of that amount (tierItems() in src/lib/plans/tips.ts).
 * This constant is the Priority step price, for copy.
 */
export const PRIORITY_MIN_MONTHLY_CENTS = stepById('priority').monthlyCents

/**
 * Customer-facing copy. EXACT wording; also in the locked English file as [STRICT]. Kept unchanged
 * until Sable delivers the ladder strings (Aria's card, build step 2).
 */
export const PRIORITY_DASHBOARD_LINE =
  'Priority included: your change requests go to the front of our queue.'
export const PRIORITY_HELP_QUESTION = 'What is Priority?'
export const PRIORITY_HELP_ANSWER =
  'Plans of $55 a month or more, counting hosting plus any add-on, get Priority. Your change requests go to the front of our queue.'

/** Admin-only badge text. */
export const PRIORITY_ADMIN_BADGE = 'Priority'
