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
 * Customer-facing copy. EXACT wording; locked in the English source (Sable, Oct 3, 3:20 PM CT,
 * freeplug-ladder-round5-tip-copy-2026-10-03.md). Built from the code: Priority comes from the step
 * rank; grandfathered plans keep the Sep 25 hosting + add-on rule; a tip never counts (tierItems).
 * The old dashboard Priority line was unused and is removed (Sable re-worded it; nothing renders it).
 */
export const PRIORITY_HELP_QUESTION = 'What is Priority?'
export const PRIORITY_HELP_ANSWER =
  'Priority comes with the Priority plan ($55 a month) and every plan above it. When you ask us for a change, your request goes ahead of requests from lower plans in line. On an older plan, you have Priority if your hosting plus any add-on comes to $55 a month or more. An optional tip doesn\'t count toward Priority.'

/** Admin-only badge text. */
export const PRIORITY_ADMIN_BADGE = 'Priority'
