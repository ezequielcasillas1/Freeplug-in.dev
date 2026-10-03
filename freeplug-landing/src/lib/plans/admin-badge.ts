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
