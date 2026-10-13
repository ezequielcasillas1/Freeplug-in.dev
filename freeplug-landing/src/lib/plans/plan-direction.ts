// Relative import on purpose: change-plan.ts (loaded by the test-mode probe script through jiti)
// re-exports planMove from here.
import type { PlanStep } from './ladder'

/**
 * Which way a move to `target` goes, for a plan that costs `currentCents` a month now. Shared by the
 * server (src/lib/stripe/change-plan.ts) and the Plans page button labels, so the label always
 * matches what the server will do.
 *   upgrade   target costs more: applied now, prorated (confirm first, Lina §3a)
 *   downgrade target costs less: at the next billing date, no confirm
 *   same      the step the plan is on (a grandfathered plan at the same price counts as an upgrade:
 *             applied now with zero proration)
 */
export type PlanMove = 'upgrade' | 'downgrade' | 'same'

export function planMove(current: Pick<PlanStep, 'id'> | null, currentCents: number, target: Pick<PlanStep, 'id' | 'monthlyCents'>): PlanMove {
  if (current && current.id === target.id) return 'same'
  if (target.monthlyCents > currentCents) return 'upgrade'
  if (target.monthlyCents === currentCents) return current ? 'same' : 'upgrade'
  return 'downgrade'
}

/**
 * How long a previewed upgrade amount can be confirmed (Aria, Oct 3 1:34 PM): the server refuses an
 * older proration_date, and the Plans page closes the confirm a little before this.
 */
export const PRORATION_DATE_MAX_AGE_SECONDS = 600
