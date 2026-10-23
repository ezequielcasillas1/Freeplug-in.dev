// Relative import on purpose (see plan-direction.ts): loaded by jiti scripts too.
import type { PlanStep } from './ladder'

/**
 * Downgrade refund rule (Ezequiel, Oct 23 2026): a move from EXACTLY the $100/month step
 * (growth) to EXACTLY the $35/month step (starter) is applied NOW, with a new $35 period starting
 * today, and 50% of the current month's $100 charge ($50) is refunded right away. Every other
 * downgrade stays at the next billing date with no refund. Matched by step id AND price, never by
 * display name. Shared by the server (change-plan.ts) and the Plans page copy.
 */
export const DOWNGRADE_REFUND_FROM = { id: 'growth', monthlyCents: 10000 } as const
export const DOWNGRADE_REFUND_TO = { id: 'starter', monthlyCents: 3500 } as const
export const DOWNGRADE_REFUND_CENTS = 5000

export function isRefundDowngrade(
  current: Pick<PlanStep, 'id' | 'monthlyCents'> | null,
  currentCents: number,
  target: Pick<PlanStep, 'id' | 'monthlyCents'>
): boolean {
  return (
    current !== null &&
    current.id === DOWNGRADE_REFUND_FROM.id &&
    current.monthlyCents === DOWNGRADE_REFUND_FROM.monthlyCents &&
    currentCents === DOWNGRADE_REFUND_FROM.monthlyCents &&
    target.id === DOWNGRADE_REFUND_TO.id &&
    target.monthlyCents === DOWNGRADE_REFUND_TO.monthlyCents
  )
}
