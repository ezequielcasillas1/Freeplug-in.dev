import type { Entitlements, PlanStepId } from './ladder'

/** Admin-only badge for a customer's plan step (customers table + requests queue). */
export type AdminPlanBadge = { stepId: PlanStepId; label: string; priority: boolean; rank: number }

export function adminPlanBadge(ent: Pick<Entitlements, 'step' | 'legacy' | 'priorityRank'>): AdminPlanBadge | null {
  if (!ent.step) return null
  return {
    stepId: ent.step.id,
    label: ent.legacy ? `${ent.step.name} (legacy)` : ent.step.name,
    priority: ent.priorityRank >= 1,
    rank: ent.priorityRank,
  }
}

const adminDollars = (cents: number) => `$${(cents / 100).toFixed(cents % 100 === 0 ? 0 : 2)}`

/**
 * Admin customers row (tipping system): the plan price and the tip as separate parts, after the step
 * badge, so the row reads "<Tier> $65/mo + $5 tip". The tip never changes the badge or the rank.
 */
export function adminPlanAmount(monthlyCents: number, tipCents: number = 0): string {
  const base = `${adminDollars(monthlyCents)}/mo`
  return tipCents > 0 ? `${base} + ${adminDollars(tipCents)} tip` : base
}
