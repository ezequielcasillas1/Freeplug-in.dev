/**
 * Included edits (Oct 18 plan structure, edit-allowance.ts; grandfathered Plus/Pro keep 1): `includedEditsPerMonth` per billing period, no rollover. Each use is a row in
 * public.included_edit_uses with a slot (1 or 2; UNIQUE (user_id, period_start, slot), migration
 * 20261004091000), so the database itself refuses more than two in a period and the server only
 * uses slots up to the entitlement. A request is counted once (request_id unique) and never in both
 * included_edit_uses and big_change_uses (trigger, SQLSTATE FP409). period_start is the
 * subscription's current_period_start as a UTC date.
 */
export function periodStartDate(start: Date | null | undefined): string | null {
  if (!start || Number.isNaN(start.getTime())) return null
  return start.toISOString().slice(0, 10)
}

/** Postgres unique_violation: that slot (or this request) is already used. */
export const INCLUDED_EDIT_ALREADY_USED_CODE = '23505'
/** edit_uses_request_once(): the request is already counted in the other table. */
export const COUNTED_IN_OTHER_TABLE_CODE = 'FP409'
/**
 * Oct 18 plan structure: up to 50 plan edits (+20 pack) or unlimited, so the slot cap is a sanity bound only
 * (migration 20261018090000 relaxes included_edit_uses_slot_check to slot >= 1); the entitlement decides.
 */
export const MAX_SMALL_EDIT_SLOTS = 1000

export type IncludedEditResult =
  | { ok: true; slot: number }
  | { ok: false; reason: 'not_included' | 'already_used' | 'already_recorded' | 'counted_elsewhere' | 'no_period' | 'error'; message: string }

type DbError = { code?: string; message?: string } | null

export interface IncludedEditStore {
  insertUse(row: { user_id: string; period_start: string; request_id: string; slot?: number }): Promise<DbError>
}

const isMissingSlotColumn = (e: DbError) => !!e && (e.code === 'PGRST204' || e.code === '42703') && /slot/.test(e.message ?? '')
const isRequestDuplicate = (e: DbError) => !!e && e.code === INCLUDED_EDIT_ALREADY_USED_CODE && /request_id/.test(e.message ?? '')

/** Records one included small edit for a request in the first free slot. Service role only (admin action). */
export async function recordIncludedEdit(
  store: IncludedEditStore,
  input: { userId: string; requestId: string; includedEditsPerMonth: number; periodStart: Date | null }
): Promise<IncludedEditResult> {
  const allowed = Math.min(MAX_SMALL_EDIT_SLOTS, Math.max(0, Math.floor(input.includedEditsPerMonth)))
  if (allowed < 1) {
    return { ok: false, reason: 'not_included', message: "This customer's plan doesn't include a small edit." }
  }
  const period = periodStartDate(input.periodStart)
  if (!period) return { ok: false, reason: 'no_period', message: 'No current billing period found in Stripe.' }
  for (let slot = 1; slot <= allowed; slot++) {
    let err = await store.insertUse({ user_id: input.userId, period_start: period, request_id: input.requestId, slot })
    // Before migration 20261004091000 (no slot column): the old one-per-period table, slot 1 only.
    if (isMissingSlotColumn(err)) {
      if (slot > 1) break
      err = await store.insertUse({ user_id: input.userId, period_start: period, request_id: input.requestId })
    }
    if (!err) return { ok: true, slot }
    if (err.code === COUNTED_IN_OTHER_TABLE_CODE) {
      return { ok: false, reason: 'counted_elsewhere', message: 'This request is already counted elsewhere.' }
    }
    if (isRequestDuplicate(err)) {
      return { ok: false, reason: 'already_recorded', message: 'This request is already counted as an included edit.' }
    }
    if (err.code !== INCLUDED_EDIT_ALREADY_USED_CODE) {
      return { ok: false, reason: 'error', message: err.message ?? 'Could not record the included edit.' }
    }
    // That slot is taken: try the next one the plan allows.
  }
  return {
    ok: false,
    reason: 'already_used',
    message: allowed === 2 ? 'Both included edits for this billing period are already used.' : allowed > 1 ? 'All included edits for this billing period are already used.' : 'The included edit for this billing period is already used.',
  }
}

