import type { PlanStepId } from './ladder'

/**
 * Edits per plan (Cheke, FINAL Oct 17 2026 11:50 PM CT; /workspace/aria/freeplug-plan-structure-final-2026-10-17.md).
 * Edits are small changes only (hours, photo swaps, price changes). New pages or features are a one-time
 * maintenance quote ($50-$100). The "+1 small edit" and "Big change" add-ons are retired (Oct 18): they no
 * longer grant anything here; their Stripe prices are left untouched.
 *
 *   Included = plan edits + edit pack - edits used this billing period (never below 0); Growth ($100) = unlimited.
 *   Edit pack ($5/mo): max one per month, no rollover, none on the $100 plan.
 */
export const PLAN_EDITS: Record<PlanStepId, number | 'unlimited'> = {
  starter: 2,
  priority: 5,
  fast_lane: 10,
  leads: 35,
  get_found: 50,
  growth: 'unlimited',
}

/** Edits the $5/mo edit pack adds per plan (0 = no pack on that plan). */
export const EDIT_PACK_EDITS: Record<PlanStepId, number> = {
  starter: 3,
  priority: 3,
  fast_lane: 10,
  leads: 10,
  get_found: 20,
  growth: 0,
}

export const EDIT_PACK_CENTS = 500
/** Packs per plan per month (Cheke: max one). */
export const MAX_EDIT_PACKS_PER_MONTH = 1

export type EditsIncluded = { unlimited: true } | { unlimited: false; total: number; used: number; remaining: number }

export function planEditsFor(stepId: PlanStepId): number | 'unlimited' {
  return PLAN_EDITS[stepId]
}

export function editPackFor(stepId: PlanStepId): number {
  return EDIT_PACK_EDITS[stepId] ?? 0
}

/** Numeric monthly allowance (Infinity for unlimited) for slot checks. */
export function monthlyEditAllowance(stepId: PlanStepId, packs: number = 0): number {
  const plan = PLAN_EDITS[stepId]
  if (plan === 'unlimited') return Number.POSITIVE_INFINITY
  return plan + editPackFor(stepId) * Math.min(MAX_EDIT_PACKS_PER_MONTH, Math.max(0, Math.floor(packs)))
}

/** "Included" on the dashboard: plan edits + edit pack - edits used (this billing period, no rollover). */
export function editsIncluded(input: { stepId: PlanStepId; hasEditPack: boolean; used: number }): EditsIncluded {
  const total = monthlyEditAllowance(input.stepId, input.hasEditPack ? 1 : 0)
  if (!Number.isFinite(total)) return { unlimited: true }
  const used = Math.max(0, Math.floor(input.used || 0))
  return { unlimited: false, total, used, remaining: Math.max(0, total - used) }
}
