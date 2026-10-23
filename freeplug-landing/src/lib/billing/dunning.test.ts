// @vitest-environment node
import { describe, expect, it, vi } from 'vitest'
import { readFileSync } from 'node:fs'
import { dunningView, memoryDunningStore, openDunning, resolveDunning, runDunningCheck } from './dunning'

const T0 = new Date('2026-11-01T15:00:00Z')
const at = (days: number, hours = 0) => new Date(T0.getTime() + days * 86_400_000 + hours * 3_600_000)
const c = { first_failed_at: T0.toISOString(), domain_expires_at: '2027-06-01T00:00:00Z' }

describe('dunningView (injected clock)', () => {
  it.each([
    [0, 'grace', 14, true],
    [1, 'grace', 13, true],
    [13, 'grace', 1, true],
    [14, 'past_due', 3, true],
    [16, 'past_due', 1, true],
    [17, 'paused', 0, false],
    [200, 'paused', 0, false],
  ] as const)('day %i -> %s (%i days left, site %s)', (d, state, left, access) => {
    const v = dunningView(c, at(d, 1))
    expect(v).toMatchObject({ state, daysLeft: left, siteAccess: access, day: d })
  })
  it('boundaries are exact: 1 ms before day 14 is still grace, day 17 at the same time is paused', () => {
    expect(dunningView(c, new Date(at(14).getTime() - 1)).state).toBe('grace')
    expect(dunningView(c, at(14)).state).toBe('past_due')
    expect(dunningView(c, new Date(at(17).getTime() - 1)).state).toBe('past_due')
    expect(dunningView(c, at(17)).state).toBe('paused')
  })
  it('domain expired only flags a paused site (never deletes)', () => {
    expect(dunningView({ ...c, domain_expires_at: at(5).toISOString() }, at(10)).domainExpired).toBe(false)
    expect(dunningView({ ...c, domain_expires_at: at(20).toISOString() }, at(19)).domainExpired).toBe(false)
    expect(dunningView({ ...c, domain_expires_at: at(20).toISOString() }, at(21)).domainExpired).toBe(true)
    expect(dunningView({ ...c, domain_expires_at: null }, at(400)).domainExpired).toBe(false)
  })
})

describe('openDunning / resolveDunning / runDunningCheck', () => {
  it('a second failed retry keeps the original day 0', async () => {
    const store = memoryDunningStore()
    expect(await openDunning(store, { subscriptionId: 'sub_1', profileId: 'p1', failedAt: T0 })).toBe('opened')
    expect(await openDunning(store, { subscriptionId: 'sub_1', profileId: 'p1', failedAt: at(3) })).toBe('already_open')
    expect(store.rows).toHaveLength(1)
    expect(store.rows[0].first_failed_at).toBe(T0.toISOString())
  })

  it('walks grace -> past_due (day 14) -> paused (day 17), once each, never deletes', async () => {
    const store = memoryDunningStore()
    await openDunning(store, { subscriptionId: 'sub_1', profileId: 'p1', failedAt: T0 })
    const onTransition = vi.fn()
    let now = at(0)
    const run = () => runDunningCheck({ store, now: () => now, onTransition })
    for (let d = 0; d <= 25; d++) {
      now = at(d, 2)
      await run()
      await run() // cron twice a day: idempotent
    }
    expect(onTransition.mock.calls.map((x) => [x[0].from, x[0].to, x[0].day])).toEqual([
      ['grace', 'past_due', 14],
      ['past_due', 'paused', 17],
    ])
    expect(store.rows).toHaveLength(1)
    expect(store.rows[0]).toMatchObject({ state: 'paused', paused_at: at(17, 2).toISOString(), resolved_at: null })
  })

  it('paying any time closes the case (also while paused): no more transitions', async () => {
    const store = memoryDunningStore()
    await openDunning(store, { subscriptionId: 'sub_1', profileId: 'p1', failedAt: T0 })
    await runDunningCheck({ store, now: () => at(18) })
    expect(store.rows[0].state).toBe('paused')
    expect(await resolveDunning(store, 'sub_1', at(30))).toBe('resolved')
    const r = await runDunningCheck({ store, now: () => at(40) })
    expect(r).toMatchObject({ checked: 0, transitions: [] })
    expect(store.rows[0]).toMatchObject({ resolved_at: at(30).toISOString() })
    // a later new failure opens a fresh case with its own 14 days
    await openDunning(store, { subscriptionId: 'sub_1', profileId: 'p1', failedAt: at(60) })
    expect(store.rows).toHaveLength(2)
    expect(dunningView(store.rows[1], at(65)).state).toBe('grace')
  })

  it('paid during grace: never marked past due', async () => {
    const store = memoryDunningStore()
    await openDunning(store, { subscriptionId: 'sub_1', profileId: 'p1', failedAt: T0 })
    await resolveDunning(store, 'sub_1', at(5))
    const onTransition = vi.fn()
    await runDunningCheck({ store, now: () => at(20), onTransition })
    expect(onTransition).not.toHaveBeenCalled()
  })

  it('reports paused cases whose domain expired (owner decides; nothing deleted)', async () => {
    const store = memoryDunningStore()
    await openDunning(store, { subscriptionId: 'sub_1', profileId: 'p1', failedAt: T0, domainExpiresAt: at(30) })
    const r = await runDunningCheck({ store, now: () => at(31) })
    expect(r.domainExpired).toEqual(['sub_1'])
    expect(store.rows).toHaveLength(1)
  })

  it('a failing notifier never blocks the state change', async () => {
    const store = memoryDunningStore()
    await openDunning(store, { subscriptionId: 'sub_1', profileId: 'p1', failedAt: T0 })
    const spy = vi.spyOn(console, 'error').mockImplementation(() => {})
    await runDunningCheck({ store, now: () => at(15), onTransition: () => { throw new Error('mail down') } })
    expect(store.rows[0].state).toBe('past_due')
    spy.mockRestore()
  })

  it('missed invoice.paid: the fresh Stripe check closes the case instead of pausing', async () => {
    const store = memoryDunningStore()
    await openDunning(store, { subscriptionId: 'sub_1', profileId: 'p1', failedAt: T0 })
    const r = await runDunningCheck({ store, now: () => at(18), stillUnpaid: async () => false })
    expect(r.resolved).toEqual(['sub_1'])
    expect(store.rows[0]).toMatchObject({ state: 'grace', resolved_at: at(18).toISOString() })
  })

  it('Stripe lookup fails: state kept (never paused on an error)', async () => {
    const store = memoryDunningStore()
    await openDunning(store, { subscriptionId: 'sub_1', profileId: 'p1', failedAt: T0 })
    const spy = vi.spyOn(console, 'error').mockImplementation(() => {})
    await runDunningCheck({ store, now: () => at(18), stillUnpaid: async () => { throw new Error('stripe down') } })
    expect(store.rows[0].state).toBe('grace')
    await runDunningCheck({ store, now: () => at(18), stillUnpaid: async () => true })
    expect(store.rows[0].state).toBe('paused')
    spy.mockRestore()
  })

  it('migration: no delete grant, one open case per subscription, client read-only own rows', () => {
    const sql = readFileSync('supabase/migrations/20261023130000_hosting_dunning.sql', 'utf8')
    expect(sql).not.toMatch(/\bdelete\b[^;]*\bto\b/i)
    expect(sql).toMatch(/unique index[^;]*\(subscription_id\) where resolved_at is null/)
    expect(sql).toMatch(/grant select on table public\.hosting_dunning to authenticated;/)
  })
})
