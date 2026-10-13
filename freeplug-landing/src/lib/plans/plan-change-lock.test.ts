// @vitest-environment node
import { readFileSync } from 'node:fs'
import path from 'node:path'
import { describe, expect, it, vi } from 'vitest'
import { PLAN_CHANGE_LOCK_TTL_SECONDS, supabasePlanChangeLockStore, withPlanChangeLock, type PlanChangeLockStore } from './plan-change-lock'

function memStore(): PlanChangeLockStore & { held: Map<string, string>; events: string[] } {
  const held = new Map<string, string>()
  const events: string[] = []
  let n = 0
  return {
    held,
    events,
    async claim(user, ttl) {
      events.push(`claim:${ttl}`)
      if (held.has(user)) return null
      const id = `c${++n}`
      held.set(user, id)
      return id
    },
    async release(user, id) {
      events.push(`release:${id}`)
      if (held.get(user) === id) held.delete(user)
    },
  }
}
const quiet = () => undefined

describe('withPlanChangeLock (claim before act, release in finally, no retry)', () => {
  it('60 s claim; the second concurrent caller gets in_progress and its action never runs', async () => {
    expect(PLAN_CHANGE_LOCK_TTL_SECONDS).toBe(60)
    const store = memStore()
    const act = vi.fn(async () => {
      await new Promise((r) => setTimeout(r, 10))
      return 'done'
    })
    const [a, b] = await Promise.all([withPlanChangeLock(store, 'u1', act, quiet), withPlanChangeLock(store, 'u1', act, quiet)])
    expect([a, b]).toEqual([{ ok: true, value: 'done' }, { ok: false, code: 'in_progress' }])
    expect(act).toHaveBeenCalledTimes(1)
    expect(store.events).toEqual(['claim:60', 'claim:60', 'release:c1'])
    expect(store.held.size).toBe(0)
  })
  it('released when the action throws (the error still propagates)', async () => {
    const store = memStore()
    await expect(withPlanChangeLock(store, 'u1', async () => { throw new Error('stripe down') }, quiet)).rejects.toThrow('stripe down')
    expect(store.held.size).toBe(0)
  })
  it('another user is not blocked', async () => {
    const store = memStore()
    store.held.set('u2', 'x')
    expect(await withPlanChangeLock(store, 'u1', async () => 1, quiet)).toEqual({ ok: true, value: 1 })
  })
  it('fails closed when the claim errors; a release error is only logged', async () => {
    const act = vi.fn(async () => 1)
    const broken: PlanChangeLockStore = { claim: async () => { throw new Error('db down') }, release: async () => undefined }
    expect(await withPlanChangeLock(broken, 'u1', act, quiet)).toEqual({ ok: false, code: 'lock_error' })
    expect(act).not.toHaveBeenCalled()
    const log = vi.fn()
    const badRelease: PlanChangeLockStore = { claim: async () => 'c1', release: async () => { throw new Error('db down') } }
    expect(await withPlanChangeLock(badRelease, 'u1', async () => 2, log)).toEqual({ ok: true, value: 2 })
    expect(log).toHaveBeenCalledWith(expect.stringContaining('release failed'))
  })
  it('the Supabase store calls the two service-role functions with the user, ttl and claim id', async () => {
    const rpc = vi.fn(async (fn: string) => (fn === 'plan_change_lock_claim' ? { data: 'c-uuid', error: null } : { data: true, error: null }))
    const store = supabasePlanChangeLockStore({ rpc })
    expect(await store.claim('u1', 60)).toBe('c-uuid')
    await store.release('u1', 'c-uuid')
    expect(rpc.mock.calls).toEqual([
      ['plan_change_lock_claim', { p_user_id: 'u1', p_ttl_seconds: 60 }],
      ['plan_change_lock_release', { p_user_id: 'u1', p_claim_id: 'c-uuid' }],
    ])
    const held = supabasePlanChangeLockStore({ rpc: async () => ({ data: null, error: null }) })
    expect(await held.claim('u1', 60)).toBeNull()
  })
  it('migration: one atomic claim statement that only takes over an EXPIRED row; service_role only', () => {
    const sql = readFileSync(path.join(__dirname, '../../../supabase/migrations/20261003210000_plan_change_locks.sql'), 'utf8')
    expect(sql).toMatch(/on conflict \(user_id\) do update[\s\S]*where l\.expires_at <= pg_catalog\.now\(\)/)
    expect(sql).toMatch(/delete from public\.plan_change_locks where user_id = p_user_id and claim_id = p_claim_id/)
    expect(sql).toMatch(/grant execute on function public\.plan_change_lock_claim\(uuid, integer\) to service_role;/)
    expect(sql).not.toMatch(/grant [^;]* to (anon|authenticated)/)
  })
})
