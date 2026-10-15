/**
 * Change-plan lock (Aria, Oct 3 2026; migration 20261003210000_plan_change_locks.sql).
 *
 * One plan change per customer at a time: a per-user row claimed BEFORE any Stripe call, with a 60 s
 * expiry, released in finally. A second change-plan (or tip change) while the row is held gets
 * 'in_progress' (UPGRADE_IN_PROGRESS on the Plans page) and never calls Stripe. No retry and no
 * waiting: the customer refreshes. Same claim-before-act pattern as email_sends.
 *
 * Fails CLOSED: if the lock can't be claimed (DB down, migration not applied) nothing runs.
 * Relative imports only: scripts/stripe-test-setup-ladder.mjs loads this file (jiti) for the probe.
 */
export const PLAN_CHANGE_LOCK_TTL_SECONDS = 60

export interface PlanChangeLockStore {
  /** The claim id when this request now holds the user's lock; null when another request holds it. Throws on DB errors. */
  claim(userId: string, ttlSeconds: number): Promise<string | null>
  /** Removes the row only if it is still this claim. */
  release(userId: string, claimId: string): Promise<void>
}

export type PlanChangeLockOutcome<T> = { ok: true; value: T } | { ok: false; code: 'in_progress' | 'lock_error' }

export async function withPlanChangeLock<T>(
  store: PlanChangeLockStore,
  userId: string,
  act: () => Promise<T>,
  log: (msg: string) => void = (m) => console.error(m)
): Promise<PlanChangeLockOutcome<T>> {
  let claimId: string | null
  try {
    claimId = await store.claim(userId, PLAN_CHANGE_LOCK_TTL_SECONDS)
  } catch (e) {
    log(`[plan-change-lock] claim failed: ${e instanceof Error ? e.message : String(e)}`)
    return { ok: false, code: 'lock_error' }
  }
  if (!claimId) return { ok: false, code: 'in_progress' }
  try {
    return { ok: true, value: await act() }
  } finally {
    try {
      await store.release(userId, claimId)
    } catch (e) {
      // The 60 s expiry frees it anyway.
      log(`[plan-change-lock] release failed: ${e instanceof Error ? e.message : String(e)}`)
    }
  }
}

type RpcClient = {
  rpc: (fn: string, args: Record<string, unknown>) => PromiseLike<{ data: unknown; error: { message: string; code?: string } | null }>
}

/** Service-role Supabase store (the functions are granted to service_role only). */
export function supabasePlanChangeLockStore(admin: RpcClient): PlanChangeLockStore {
  return {
    async claim(userId, ttlSeconds) {
      const { data, error } = await admin.rpc('plan_change_lock_claim', { p_user_id: userId, p_ttl_seconds: ttlSeconds })
      if (error) throw new Error(`plan_change_lock_claim: ${error.code ?? ''} ${error.message}`)
      return typeof data === 'string' && data.length > 0 ? data : null
    },
    async release(userId, claimId) {
      const { error } = await admin.rpc('plan_change_lock_release', { p_user_id: userId, p_claim_id: claimId })
      if (error) throw new Error(`plan_change_lock_release: ${error.code ?? ''} ${error.message}`)
    },
  }
}
