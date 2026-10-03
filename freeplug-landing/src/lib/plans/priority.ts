/**
 * Priority (approved by Ezequiel, Sep 25 2026): plans whose monthly total (hosting plus any add-on)
 * is $55 or more get Priority. The threshold lives only here.
 */
export const PRIORITY_MIN_MONTHLY_CENTS = 5500

/** Customer-facing copy. EXACT wording; also in the locked English file as [STRICT]. */
export const PRIORITY_DASHBOARD_LINE =
  'Priority included: your change requests go to the front of our queue.'
export const PRIORITY_HELP_QUESTION = 'What is Priority?'
export const PRIORITY_HELP_ANSWER =
  'Plans of $55 a month or more, counting hosting plus any add-on, get Priority. Your change requests go to the front of our queue.'

/** Admin-only badge text. */
export const PRIORITY_ADMIN_BADGE = 'Priority'

/** Same statuses the dashboard's plan card shows as active. */
const PRIORITY_STATUSES = new Set(['active', 'trialing'])

/** A plan amount (sum of its items, in cents) as a monthly amount. Unknown intervals count as 0. */
export function monthlyCents(amountCents: number, interval: string): number {
  if (interval === 'month') return amountCents
  if (interval === 'year') return Math.round(amountCents / 12)
  return 0
}

export function qualifiesForPriority(monthlyTotalCents: number): boolean {
  return monthlyTotalCents >= PRIORITY_MIN_MONTHLY_CENTS
}

/** Monthly total of the customer's active plans (hosting + add-on items). */
export function planMonthlyTotalCents(
  plans: ReadonlyArray<{ status: string; amount: number; interval: string }>
): number {
  return plans
    .filter((p) => PRIORITY_STATUSES.has(p.status))
    .reduce((sum, p) => sum + monthlyCents(p.amount, p.interval), 0)
}
