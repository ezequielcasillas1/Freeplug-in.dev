/**
 * Included small edit (Fast lane and up, plus grandfathered Plus/Pro): one per billing period, no
 * rollover. The count lives in public.included_edit_uses with UNIQUE (user_id, period_start), so the
 * database itself refuses a second use in the same period. period_start is the subscription's
 * current_period_start as a UTC date.
 */
export function periodStartDate(start: Date | null | undefined): string | null {
  if (!start || Number.isNaN(start.getTime())) return null
  return start.toISOString().slice(0, 10)
}

/** Postgres unique_violation: the period's included edit is already used. */
export const INCLUDED_EDIT_ALREADY_USED_CODE = '23505'

export type IncludedEditResult =
  | { ok: true }
  | { ok: false; reason: 'not_included' | 'already_used' | 'no_period' | 'error'; message: string }

export interface IncludedEditStore {
  insertUse(row: { user_id: string; period_start: string; request_id: string }): Promise<{ code?: string; message?: string } | null>
}

/** Records the period's included edit for a request. Service role only (admin action). */
export async function recordIncludedEdit(
  store: IncludedEditStore,
  input: { userId: string; requestId: string; includedEditsPerMonth: number; periodStart: Date | null }
): Promise<IncludedEditResult> {
  if (input.includedEditsPerMonth < 1) {
    return { ok: false, reason: 'not_included', message: "This customer's plan doesn't include a small edit." }
  }
  const period = periodStartDate(input.periodStart)
  if (!period) return { ok: false, reason: 'no_period', message: 'No current billing period found in Stripe.' }
  const err = await store.insertUse({ user_id: input.userId, period_start: period, request_id: input.requestId })
  if (!err) return { ok: true }
  if (err.code === INCLUDED_EDIT_ALREADY_USED_CODE) {
    return { ok: false, reason: 'already_used', message: 'The included edit for this billing period is already used.' }
  }
  return { ok: false, reason: 'error', message: err.message ?? 'Could not record the included edit.' }
}
