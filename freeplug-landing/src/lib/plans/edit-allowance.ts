import type { PlanStepId } from './ladder'

/**
 * Edits per plan (Nov 2026 owner pricing). Edits are small changes only (hours, photo swaps, price changes).
 * New pages or features are a one-time maintenance quote ($50-$100). The "+1 small edit" and "Big change"
 * add-ons are retired (Oct 18); edit packs are no longer sold (Nov 2026).
 */
export const PLAN_EDITS: Record<PlanStepId, number | 'unlimited'> = {
  starter: 2,
  priority: 5,
  fast_lane: 7,
  leads: 12,
  get_found: 15,
  growth: 20,
  plug_authority: 25,
}

/** Retired: edit packs are not sold; kept for allowance math only (always 0). */
export const EDIT_PACK_EDITS: Record<PlanStepId, number> = {
  starter: 0,
  priority: 0,
  fast_lane: 0,
  leads: 0,
  get_found: 0,
  growth: 0,
  plug_authority: 0,
}

export const EDIT_PACK_CENTS = 500
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

/** "Included" on the dashboard: plan edits - edits used (this billing period, no rollover). */
export function editsIncluded(input: { stepId: PlanStepId; hasEditPack: boolean; used: number }): EditsIncluded {
  const total = monthlyEditAllowance(input.stepId, input.hasEditPack ? 1 : 0)
  if (!Number.isFinite(total)) return { unlimited: true }
  const used = Math.max(0, Math.floor(input.used || 0))
  return { unlimited: false, total, used, remaining: Math.max(0, total - used) }
}
