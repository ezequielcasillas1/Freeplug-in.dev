// @vitest-environment node
import { beforeEach, describe, expect, it, vi } from 'vitest'
import type Stripe from 'stripe'

/**
 * The Supabase owed-removal store and the internal alerts (Vera QA de173c8: L-4 G, L-5, L-1 both-failed).
 * No database, no email: a fake of the slice of the Supabase client the store uses, and mocked senders.
 */
const h = vi.hoisted(() => ({
  ledger: new Set<string>(),
  ledgerCalls: [] as { key: string; template: string }[],
  mails: [] as { to: string; subject: string; text?: string; template?: string; idempotencyKey?: string }[],
  mailFails: false,
}))
vi.mock('@/lib/supabase/admin', () => ({ createAdminClient: () => ({}) }))
vi.mock('@/lib/email/mailer', () => ({
  sendMail: async (p: { to: string; subject: string; text?: string; template?: string; idempotencyKey?: string }) => {
    if (h.mailFails) return { success: false, error: 'down', reason: 'network' }
    h.mails.push(p)
    return { success: true, id: `re_${h.mails.length}` }
  },
}))
// The email_sends ledger: once per (key, template), like the real claim RPC.
vi.mock('@/lib/email/webhook-email-ledger', () => ({
  sendWebhookEmailOnce: async (key: string, template: string, _label: string, send: () => Promise<{ success: boolean }>) => {
    h.ledgerCalls.push({ key, template })
    if (h.ledger.has(`${key}|${template}`)) return 'skipped'
    h.ledger.add(`${key}|${template}`)
    return (await send()).success ? 'sent' : 'send_failed'
  },
}))

import { removalOwedAlertKey, resumeRemovalOwed, sendRemovalOwedAlert, sendRemovalOwedUnrecordedAlert, supabaseRemovalOwedStore, type RemovalOwedDb } from './addon-removal-owed-server'
import { healOwedRemovals } from './addon-removal-owed'
import { createStripeSim } from '../../../test/stripe-addon-sim'

type Row = Record<string, unknown>
/** addon_removals_owed with its partial unique index (one open row per subscription). */
function fakeDb() {
  const rows: Row[] = []
  const db = {
    from: () => {
      const filters: [string, unknown][] = []
      const q = {
        select: () => q,
        eq: (c: string, v: unknown) => (filters.push([c, v]), q),
        is: (c: string, v: unknown) => (filters.push([c, v]), q),
        then: (res: (v: { data: Row[]; error: null }) => unknown) =>
          Promise.resolve({ data: rows.filter((r) => filters.every(([c, v]) => (r[c] ?? null) === v)).map((r) => ({ ...r })), error: null }).then(res),
        insert: async (row: Row) => {
          if (rows.some((r) => r.stripe_subscription_id === row.stripe_subscription_id && r.cleared_at == null)) return { error: { code: '23505', message: 'duplicate key value violates unique constraint "addon_removals_owed_one_open"' } }
          rows.push({ id: `ow_${rows.length + 1}`, cleared_at: null, cleared_how: null, source: 'upgrade', ...row })
          return { error: null }
        },
        update: (v: Row) => ({
          eq: async (_c: string, id: string) => {
            const r = rows.find((x) => x.id === id)
            if (r) Object.assign(r, v)
            return { error: null }
          },
        }),
      }
      return q
    },
  }
  return { db: db as unknown as RemovalOwedDb, rows }
}

const T0 = Math.floor(new Date('2026-10-04T14:00:00Z').getTime() / 1000)
const START = T0 - 10 * 86_400
const END = START + 30 * 86_400
const owed = (addons: ('small_edit' | 'big_change')[]) => ({ subscriptionId: 'sub_1', customerId: 'cus_1', userId: 'u1', addons, effectiveAt: new Date(END * 1000).toISOString() })

describe('Vera L-5: a resume add-on never hides under an open upgrade row', () => {
  it('upgrade row open, then a resume owes another add-on: ONE row, labelled resume (the amber box shows both), and the renewal refunds both lines once', async () => {
    const { db, rows } = fakeDb()
    await supabaseRemovalOwedStore(db, 'upgrade').save(owed(['small_edit']))
    expect(await resumeRemovalOwed(['sub_1'], supabaseRemovalOwedStore(db))).toEqual({ addons: [], effectiveAt: null }) // upgrade only: no box
    await supabaseRemovalOwedStore(db, 'resume').save(owed(['big_change']))
    expect(rows).toHaveLength(1)
    expect(rows[0]).toMatchObject({ source: 'resume', addons: ['small_edit', 'big_change'], cleared_at: null })
    expect(await resumeRemovalOwed(['sub_1'], supabaseRemovalOwedStore(db))).toEqual({ addons: ['small_edit', 'big_change'], effectiveAt: owed([]).effectiveAt })
    // the single refund: the renewal still bills both; the self-heal removes both and refunds them in one credit note
    const sim = createStripeSim({ nowSec: T0 })
    sim.addCustomer('cus_1')
    sim.addSub({ id: 'sub_1', customer: 'cus_1', step: 'priority', addons: ['small_edit', 'big_change'], periodStart: START })
    sim.advance(26 * 86_400)
    const renewal = sim.invoices().find((i) => i.billing_reason === 'subscription_cycle')!
    const heal = () => healOwedRemovals({ stripe: sim.client() as unknown as Stripe, store: supabaseRemovalOwedStore(db), log: () => {} }, renewal as unknown as Parameters<typeof healOwedRemovals>[1])
    expect(await heal()).toMatchObject({ outcome: 'refunded' })
    expect(await heal()).toMatchObject({ outcome: 'none' })
    expect(sim.creditNotes).toEqual([expect.objectContaining({ invoice: renewal.id, amount: 1075 })])
    expect(rows[0]).toMatchObject({ cleared_how: 'refunded' })
  })

  it('a resume row open, then an upgrade owes another add-on: the row keeps the resume label (the box never disappears)', async () => {
    const { db, rows } = fakeDb()
    await supabaseRemovalOwedStore(db, 'resume').save(owed(['big_change']))
    await supabaseRemovalOwedStore(db, 'upgrade').save(owed(['small_edit']))
    expect(rows).toHaveLength(1)
    expect(rows[0]).toMatchObject({ source: 'resume', addons: ['big_change', 'small_edit'] })
  })

  it('two upgrades stay an upgrade row (no box)', async () => {
    const { db, rows } = fakeDb()
    await supabaseRemovalOwedStore(db, 'upgrade').save(owed(['big_change']))
    await supabaseRemovalOwedStore(db, 'upgrade').save(owed(['small_edit']))
    expect(rows[0]).toMatchObject({ source: 'upgrade' })
    expect((await resumeRemovalOwed(['sub_1'], supabaseRemovalOwedStore(db))).addons).toEqual([])
  })
})

describe('Vera L-4 G: the removal-owed alert goes out once per removal (no alert spam)', () => {
  beforeEach(() => {
    h.ledger.clear()
    h.ledgerCalls = []
    h.mails = []
    h.mailFails = false
  })
  it('the same owed removal alerted twice (retries, redeliveries, a second request): one email, one stable ledger key', async () => {
    const o = owed(['big_change'])
    expect(removalOwedAlertKey(o)).toBe(`removal-owed:sub_1:${END}`)
    expect(await sendRemovalOwedAlert(o)).toBe('sent')
    expect(await sendRemovalOwedAlert({ ...o })).toBe('skipped')
    expect(h.mails).toHaveLength(1)
    expect(h.mails[0]).toMatchObject({ to: 'support@freeplug-in.dev', subject: '[Freeplug billing] Add-on removal owed on sub_1', template: 'removal-owed-alert', idempotencyKey: `removal-owed:sub_1:${END}:removal-owed-alert` })
    expect(h.ledgerCalls).toEqual([
      { key: `removal-owed:sub_1:${END}`, template: 'removal-owed-alert' },
      { key: `removal-owed:sub_1:${END}`, template: 'removal-owed-alert' },
    ])
  })
  it('a different removal (another subscription or period) is its own alert', async () => {
    await sendRemovalOwedAlert(owed(['big_change']))
    await sendRemovalOwedAlert({ ...owed(['big_change']), subscriptionId: 'sub_2' })
    await sendRemovalOwedAlert({ ...owed(['big_change']), effectiveAt: new Date((END + 30 * 86_400) * 1000).toISOString() })
    expect(h.mails).toHaveLength(3)
  })
})

describe('Vera L-1: the both-failed alert (nothing saved, undo refused) reaches the support inbox without the database', () => {
  beforeEach(() => {
    h.ledger.clear()
    h.ledgerCalls = []
    h.mails = []
    h.mailFails = false
  })
  const lost = { ...owed(['big_change']), scheduleId: 'sub_sched_1', putBackError: 'boom-update', undoError: 'subscription is managed by a schedule' }
  it('sent straight through sendMail (no email ledger), labelled "(NOT SAVED, fix by hand)", with a stable Resend key and the recovery steps', async () => {
    await sendRemovalOwedUnrecordedAlert(lost)
    expect(h.ledgerCalls).toEqual([])
    expect(h.mails).toEqual([
      expect.objectContaining({
        to: 'support@freeplug-in.dev',
        subject: '[Freeplug billing] Add-on removal owed on sub_1 (NOT SAVED, fix by hand)',
        template: 'removal-owed-unrecorded-alert',
        idempotencyKey: `removal-owed-unrecorded:sub_1:${END}`,
      }),
    ])
    for (const s of ['sub_sched_1', 'boom-update', 'subscription is managed by a schedule', 'cus_1', 'u1', 'big_change', 'To recover:']) expect(h.mails[0].text).toContain(s)
  })
  it('a failed send throws (so the caller logs it)', async () => {
    h.mailFails = true
    await expect(sendRemovalOwedUnrecordedAlert(lost)).rejects.toThrow('removal-owed unrecorded alert not sent')
  })
})
