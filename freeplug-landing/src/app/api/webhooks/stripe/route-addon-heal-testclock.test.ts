// @vitest-environment node
import { beforeEach, describe, expect, it, vi } from 'vitest'
import type Stripe from 'stripe'
import type { AddonId } from '@/lib/plans/ladder'
import { createStripeSim, SIM_PRICE_ID, type SimEvent, type StripeSim } from '../../../../../test/stripe-addon-sim'

/**
 * TEST-CLOCK test (Aria, Oct 4 8:59 AM CT, ruling 2d), SIMULATED: the crash between paying for an add-on
 * and adding it, healed by the REAL webhook route (invoice.paid). Stripe is the in-memory stand-in with
 * a simulated clock (test/stripe-addon-sim.ts); the change-plan lock is the same claim/release RPC
 * shape on that clock; the ledger is the route's own code. No real Stripe test clock: every test-mode
 * event on the box reaches the :3000 listener (team rule, Vera and Jace 9:03), so Vera runs the real
 * one after Ezequiel's :3000 review.
 */
const h = vi.hoisted(() => ({
  sim: null as null | import('../../../../../test/stripe-addon-sim').StripeSim,
  event: null as unknown,
  ledger: [] as { stripe_invoice_id: string; amount_cents: number }[],
  total: 0,
  /** email_sends rows (the real claim / finish RPC shape): `${stripe_event_id}|${template}`. */
  emailRows: new Map<string, { id: string; status: string }>(),
  emails: [] as { to: string; addonName: string; note: string; subject?: string; key?: string }[],
  /** addon_removals_owed rows (L-1), the store's query shape. */
  owed: [] as Record<string, unknown>[],
}))
// No real email (tests only): the Resend send is a spy; the email_sends ledger is the real code below.
vi.mock('@/lib/email/send', async (orig) => ({
  ...(await orig<typeof import('@/lib/email/send')>()),
  sendAddonRefundedEmail: async (to: string, p: { addonName: string; note: string; subject?: string }, o?: { idempotencyKey?: string }) => {
    h.emails.push({ to, ...p, key: o?.idempotencyKey })
    return { success: true as const, id: `re_${h.emails.length}` }
  },
}))
vi.mock('@/lib/stripe/server', () => ({
  getStripe: () => ({ ...h.sim!.client(), webhooks: { constructEventAsync: async () => h.event } }),
}))
vi.mock('@/lib/stripe/prices', async (orig) => ({ ...(await orig<typeof import('@/lib/stripe/prices')>()), getAddonPriceId: async (id: AddonId) => `price_addon_${id}` }))
vi.mock('@/lib/outreach/server', () => ({ handleOutreachInvoicePaid: async () => false, handleOutreachSetupSession: async () => false }))
// Real self-heal; only the lock WAIT is zero (a held lock answers non-2xx at once instead of after 8 s).
vi.mock('@/lib/stripe/addon-heal-webhook', async (orig) => {
  const actual = await orig<typeof import('@/lib/stripe/addon-heal-webhook')>()
  return {
    ...actual,
    healAddonChargeFromWebhook: (d: Parameters<typeof actual.healAddonChargeFromWebhook>[0], inv: Parameters<typeof actual.healAddonChargeFromWebhook>[1]) =>
      actual.healAddonChargeFromWebhook({ ...d, lockWaitMs: 0, now: h.sim!.now, log: () => {} }, inv),
  }
})
vi.mock('@/lib/supabase/admin', () => ({
  createAdminClient: () => ({
    // plan_change_lock_claim / _release on the simulated clock
    rpc: async (fn: string, args: { p_user_id: string; p_ttl_seconds?: number; p_claim_id?: string }) => {
      if (fn === 'plan_change_lock_claim') return { data: await h.sim!.lockStore.claim(args.p_user_id, args.p_ttl_seconds ?? 60), error: null }
      if (fn === 'plan_change_lock_release') return { data: (await h.sim!.lockStore.release(args.p_user_id, args.p_claim_id!), true), error: null }
      if (fn === 'email_send_claim') {
        const a = args as unknown as { p_stripe_event_id: string; p_template: string }
        const k = `${a.p_stripe_event_id}|${a.p_template}`
        if (h.emailRows.has(k)) return { data: [], error: null }
        const id = `es_${h.emailRows.size + 1}`
        h.emailRows.set(k, { id, status: 'pending' })
        return { data: [{ id, attempts: 1 }], error: null }
      }
      if (fn === 'email_send_finish') {
        const a = args as unknown as { p_id: string; p_status: string }
        for (const r of h.emailRows.values()) if (r.id === a.p_id) r.status = a.p_status
        return { data: true, error: null }
      }
      throw new Error(`unexpected rpc ${fn}`)
    },
    from: (table: string) => {
      if (table === 'outreach_sites' || table === 'outreach_events') {
        const q: Record<string, unknown> = {}
        for (const m of ['select', 'eq', 'is', 'in', 'order', 'limit']) q[m] = () => q
        q.maybeSingle = async () => ({ data: null, error: null })
        return q
      }
      if (table === 'profiles') {
        const q = {
          select: () => q,
          eq: () => q,
          limit: async () => ({ data: [{ id: 'p1', cumulative_website_value_paid_cents: h.total }], error: null }),
          update: (v: { cumulative_website_value_paid_cents?: number }) => {
            if (typeof v.cumulative_website_value_paid_cents === 'number') h.total = v.cumulative_website_value_paid_cents
            return { eq: async () => ({ error: null }) }
          },
        }
        return q
      }
      if (table === 'billing_ledger') {
        return {
          insert: async (row: { stripe_invoice_id: string; amount_cents: number }) => {
            if (h.ledger.some((r) => r.stripe_invoice_id === row.stripe_invoice_id)) return { error: { code: '23505' } }
            h.ledger.push(row)
            return { error: null }
          },
        }
      }
      if (table === 'addon_removals_owed') {
        const filters: [string, unknown][] = []
        const q = {
          select: () => q,
          eq: (c: string, v: unknown) => (filters.push([c, v]), q),
          is: (c: string, v: unknown) => (filters.push([c, v ?? null]), q),
          then: (res: (v: { data: unknown[]; error: null }) => unknown) =>
            Promise.resolve({ data: h.owed.filter((r) => filters.every(([c, v]) => (r[c] ?? null) === v)).map((r) => ({ ...r })), error: null }).then(res),
          insert: async (row: Record<string, unknown>) => {
            if (h.owed.some((r) => r.stripe_subscription_id === row.stripe_subscription_id && r.cleared_at == null)) return { error: { code: '23505', message: 'dup' } }
            h.owed.push({ id: `ow_${h.owed.length + 1}`, cleared_at: null, ...row })
            return { error: null }
          },
          update: (v: Record<string, unknown>) => ({
            eq: async (_c: string, id: string) => {
              const r = h.owed.find((x) => x.id === id)
              if (r) Object.assign(r, v)
              return { error: null }
            },
          }),
        }
        return q
      }
      throw new Error(`unexpected table ${table}`)
    },
  }),
}))

import { POST } from './route'
import { changeAddon, previewAddonChange } from '@/lib/stripe/change-plan'
import { listInvoicesForCustomer } from '@/lib/stripe/billing-routing'
import { recentAddonRefundNotes } from '@/components/plans/AddonRefundNotes'
import { ADDON_NAMES, ADDON_REFUND_REASONS, addonAddedToNextBill, addonRefundNote, type AddonRefundReason } from '@/lib/plans/ladder-copy'

const USER = '11111111-2222-4333-8444-555555555555'
const T0 = Math.floor(new Date('2026-10-04T14:00:00Z').getTime() / 1000)
type SubArg = Parameters<typeof changeAddon>[1]

async function deliver(ev: SimEvent) {
  h.event = ev
  const res = await POST(new Request('http://localhost/api/webhooks/stripe', { method: 'POST', headers: { 'stripe-signature': 't=1,v1=x' }, body: '{}' }))
  return res.status
}
const addonItems = (sim: StripeSim, id: AddonId) => sim.sub('sub_1').items.data.filter((i) => i.price.id === SIM_PRICE_ID.addon(id))
const tipOf = (sim: StripeSim) => sim.sub('sub_1').items.data.find((i) => i.price.id === SIM_PRICE_ID.tip)?.quantity ?? 0

/** The Plans page request: holds the user's lock, charges, and dies right after the payment. */
async function crashAfterPay(sim: StripeSim, addon: AddonId, tipDropTo?: number) {
  await sim.lockStore.claim(USER, 60)
  await changeAddon(
    { stripe: sim.client({ crashAfter: 'invoices.pay' }) as unknown as Stripe, addonPriceIdFor: async (id) => SIM_PRICE_ID.addon(id), now: sim.now, log: () => {} },
    sim.sub('sub_1') as unknown as SubArg,
    addon,
    'on',
    { userId: USER, prorationDate: sim.nowSec(), tipDropTo }
  )
  return sim.events.find((e) => e.data.object.metadata.freeplug_kind === 'addon_first_period')!
}

describe('simulated test clock: crash between paying and adding, healed by invoice.paid', () => {
  beforeEach(() => {
    process.env.STRIPE_WEBHOOK_SECRET = 'whsec_test'
    process.env.SUPABASE_SERVICE_ROLE_KEY = 'x'
    h.ledger.length = 0
    h.total = 0
    h.emailRows.clear()
    h.emails.length = 0
    h.owed.length = 0
    vi.spyOn(console, 'info').mockImplementation(() => undefined)
    vi.spyOn(console, 'warn').mockImplementation(() => undefined)
    vi.spyOn(console, 'error').mockImplementation(() => undefined)
  })

  it('Starter $19 tip: crash -> 500 while the lock is held -> added on redelivery (tip $14) -> renewal $54, one item, ledger once', async () => {
    const sim = (h.sim = createStripeSim({ nowSec: T0 }))
    sim.addCustomer('cus_1')
    sim.addSub({ id: 'sub_1', customer: 'cus_1', step: 'starter', tip: 19, periodStart: T0 - 10 * 86_400 })
    const paid = await crashAfterPay(sim, 'small_edit', 14)
    expect(paid.data.object).toMatchObject({ status: 'paid', amount_paid: 500 })
    expect(addonItems(sim, 'small_edit')).toHaveLength(0)

    // T0+2s: first delivery; the crashed request's lock is still held -> non-2xx, Stripe will redeliver
    sim.advance(2)
    expect(await deliver(paid)).toBe(500)
    expect(addonItems(sim, 'small_edit')).toHaveLength(0)
    expect(h.ledger).toEqual([expect.objectContaining({ stripe_invoice_id: paid.data.object.id, amount_cents: 500 })]) // booked once anyway

    // T0+63s: lock expired; Stripe's retry heals it
    sim.advance(61)
    expect(await deliver(paid)).toBe(200)
    expect(addonItems(sim, 'small_edit')).toHaveLength(1)
    expect(tipOf(sim)).toBe(14)

    // duplicate + concurrent deliveries: still one item, ledger unchanged
    expect(await Promise.all([deliver(paid), deliver(paid)])).toEqual([200, 200])
    expect(addonItems(sim, 'small_edit')).toHaveLength(1)
    expect(h.ledger).toHaveLength(1)
    expect(h.total).toBe(500)

    // the clock reaches the renewal: $35 + $5 + $14 = $54 billed and booked
    sim.advance(21 * 86_400)
    const renewal = sim.events.find((e) => e.data.object.billing_reason === 'subscription_cycle')!
    expect(renewal.data.object.total).toBe(5400)
    expect(await deliver(renewal)).toBe(200)
    expect(h.ledger.map((r) => r.amount_cents)).toEqual([500, 5400])
    // the first event replayed after the renewal: nothing changes
    expect(await deliver(paid)).toBe(200)
    expect(addonItems(sim, 'small_edit')).toHaveLength(1)
    expect(sim.creditNotes).toHaveLength(0)
  })

  it('crash, then the plan is canceled before the retry: refunded automatically once; Total Paid still counts it (ruling 2c)', async () => {
    const sim = (h.sim = createStripeSim({ nowSec: T0 }))
    sim.addCustomer('cus_1')
    sim.addSub({ id: 'sub_1', customer: 'cus_1', step: 'priority', periodStart: T0 - 10 * 86_400 })
    const paid = await crashAfterPay(sim, 'big_change')
    sim.cancel('sub_1')
    sim.advance(61)
    expect(await deliver(paid)).toBe(200)
    expect(await deliver(paid)).toBe(200)
    expect(sim.creditNotes).toEqual([expect.objectContaining({ invoice: paid.data.object.id, amount: 575, refund_amount: 575 })])
    expect(sim.invoice(paid.data.object.id).metadata.addon_refunded).toBe('true')
    expect(h.total).toBe(575) // refunds stay counted for now (src/pending-later.txt)
  })

  // ---------------------------------------------------------------- Aria, Oct 4 9:27 AM CT

  it('ruling 4: the SAME event id delivered again after a success is a no-op: no second add, no second refund, no second ledger row', async () => {
    const sim = (h.sim = createStripeSim({ nowSec: T0 }))
    sim.addCustomer('cus_1')
    sim.addSub({ id: 'sub_1', customer: 'cus_1', step: 'priority', periodStart: T0 - 10 * 86_400 })
    const paid = await crashAfterPay(sim, 'big_change')
    sim.advance(61)
    expect(await deliver(paid)).toBe(200)
    expect(addonItems(sim, 'big_change')).toHaveLength(1)
    const writes = () => sim.log.filter((c) => /subscriptions\.update|creditNotes\.create|invoices\.create/.test(c)).length
    const before = writes()
    for (let i = 0; i < 3; i++) expect(await deliver(paid)).toBe(200) // same event object, same evt_ id
    expect(paid.id).toMatch(/^evt_/)
    expect(addonItems(sim, 'big_change')).toHaveLength(1)
    expect(sim.creditNotes).toHaveLength(0)
    expect(writes()).toBe(before)
    expect(h.ledger).toEqual([expect.objectContaining({ stripe_invoice_id: paid.data.object.id, amount_cents: 575 })])
    expect(h.total).toBe(575)
    expect(h.emails).toHaveLength(0)
  })

  it('ruling 4, refund side: the same event id after a refund: still one credit note, one email, one ledger row', async () => {
    const sim = (h.sim = createStripeSim({ nowSec: T0 }))
    sim.addCustomer('cus_1')
    sim.addSub({ id: 'sub_1', customer: 'cus_1', step: 'priority', periodStart: T0 - 10 * 86_400 })
    const paid = await crashAfterPay(sim, 'big_change')
    sim.cancel('sub_1')
    sim.advance(61)
    for (let i = 0; i < 3; i++) expect(await deliver(paid)).toBe(200)
    expect(sim.creditNotes).toHaveLength(1)
    expect(h.emails).toHaveLength(1)
    expect(h.emails[0]).toMatchObject({ to: 'cus_1@sim.invalid', key: `addon-refund:${paid.data.object.id}:addon-refunded` })
    expect(h.ledger).toHaveLength(1)
  })

  // ruling 1: refunds in the three extra cases, logged, with a plain-English reason on the Plans page and in the email
  const reasonCases: { name: string; reason: AddonRefundReason; sentence: string; setup: (sim: StripeSim) => Promise<void> | void; step: 'priority' | 'starter'; addon: AddonId; tip?: number; addons?: AddonId[] }[] = [
    {
      name: 'a plan switch was scheduled before the retry',
      reason: 'switch_pending',
      sentence: "We couldn't turn on Big change because a plan switch was already scheduled. Add-ons can't change until the switch happens.",
      step: 'priority',
      addon: 'big_change',
      setup: async (sim) => {
        const c = sim.client()
        const sc = await c.subscriptionSchedules.create({ from_subscription: 'sub_1' })
        const ph = sc.phases[0]
        await c.subscriptionSchedules.update(sc.id, {
          phases: [
            { items: ph.items, start_date: ph.start_date, end_date: ph.end_date },
            { items: [{ price: SIM_PRICE_ID.step('starter'), quantity: 1 }], metadata: { plan_step: 'starter', addons: '', tip_dollars: '0', kind: 'switch' } },
          ],
        })
      },
    },
    {
      name: 'an add-on removal was scheduled before the retry',
      reason: 'removal_pending',
      sentence: "We couldn't turn on Big change because another add-on was already set to end. Add-ons can't change until it ends.",
      step: 'priority',
      addon: 'big_change',
      addons: ['small_edit'],
      setup: async (sim) => {
        const c = sim.client()
        const sc = await c.subscriptionSchedules.create({ from_subscription: 'sub_1' })
        const ph = sc.phases[0]
        await c.subscriptionSchedules.update(sc.id, {
          phases: [
            { items: ph.items, start_date: ph.start_date, end_date: ph.end_date },
            { items: [{ price: SIM_PRICE_ID.step('priority'), quantity: 1 }], metadata: { plan_step: 'priority', addons: '', tip_dollars: '0', kind: 'addons' } },
          ],
        })
      },
    },
    {
      name: 'the billing period ended before the retry',
      reason: 'period_ended',
      sentence: "We couldn't turn on Big change because the billing period you paid for ended before we could add it.",
      step: 'priority',
      addon: 'big_change',
      setup: (sim) => sim.advance(21 * 86_400),
    },
    {
      name: 'a tip drop the customer never confirmed would now be needed',
      reason: 'tip_unconfirmed',
      sentence: "We couldn't turn on +1 small edit because it would have lowered your tip, which you hadn't confirmed.",
      step: 'starter',
      addon: 'small_edit',
      tip: 9,
      setup: async (sim) => {
        // the tip went up to $19 after the charge: now Starter's $54 needs it at $14, which wasn't confirmed
        const tipItem = sim.sub('sub_1').items.data.find((i) => i.price.id === SIM_PRICE_ID.tip)!
        await sim.client().subscriptions.update('sub_1', { items: [{ id: tipItem.id, quantity: 19 }], proration_behavior: 'none' })
      },
    },
  ]
  it.each(reasonCases)('ruling 1: $reason ($name): refunded once, logged, the reason on the Plans page and in the email', async (c) => {
    const sim = (h.sim = createStripeSim({ nowSec: T0 }))
    sim.addCustomer('cus_1')
    sim.addSub({ id: 'sub_1', customer: 'cus_1', step: c.step, addons: c.addons, tip: c.tip, periodStart: T0 - 10 * 86_400 })
    const paid = await crashAfterPay(sim, c.addon)
    await c.setup(sim)
    sim.advance(61)
    const logs: string[] = []
    ;(console.error as unknown as { mockImplementation: (f: (...a: unknown[]) => void) => void }).mockImplementation((...a) => logs.push(a.join(' ')))
    ;(console.info as unknown as { mockImplementation: (f: (...a: unknown[]) => void) => void }).mockImplementation((...a) => logs.push(a.join(' ')))
    expect(await deliver(paid)).toBe(200)
    expect(await deliver(paid)).toBe(200)
    const cents = c.addon === 'big_change' ? 575 : 500
    expect(sim.creditNotes).toEqual([expect.objectContaining({ invoice: paid.data.object.id, amount: cents, refund_amount: cents })])
    expect(sim.invoice(paid.data.object.id).metadata).toMatchObject({ addon_refunded: 'true', addon_refund_reason: c.reason, addon_refund_card_cents: String(cents), addon_refund_credit_cents: '0' })
    expect(logs.join('\n')).toContain(`add-on charge ${paid.data.object.id} refunded`)
    // the reason, in plain words, then where the money went
    const name = ADDON_NAMES[c.addon]
    expect(ADDON_REFUND_REASONS[c.reason](name)).toBe(c.sentence)
    const note = `${c.sentence} We refunded ${cents === 575 ? '$5.75' : '$5'} to your card. The card refund can take 5–10 business days to show up.`
    expect(addonRefundNote(name, c.reason, cents, 0)).toBe(note)
    expect(h.emails).toEqual([expect.objectContaining({ addonName: name, note })])
    const rows = await listInvoicesForCustomer(sim.client() as unknown as Stripe, 'cus_1')
    expect(recentAddonRefundNotes(rows, sim.now())).toEqual([{ id: paid.data.object.id, text: note }])
  })

  it('ruling 1, credit paid part of it: the note and email split card and account credit (Sable 9:29)', async () => {
    const sim = (h.sim = createStripeSim({ nowSec: T0 }))
    sim.addCustomer('cus_1', 200)
    sim.addSub({ id: 'sub_1', customer: 'cus_1', step: 'priority', periodStart: T0 - 10 * 86_400 })
    const paid = await crashAfterPay(sim, 'big_change')
    expect(paid.data.object).toMatchObject({ total: 575, amount_paid: 375 })
    sim.cancel('sub_1')
    sim.advance(61)
    expect(await deliver(paid)).toBe(200)
    expect(sim.creditNotes).toEqual([expect.objectContaining({ amount: 575, refund_amount: 375, credit_amount: 200 })])
    expect(sim.customer('cus_1').balance).toBe(-200) // the $2 of credit is back
    const note = "We couldn't turn on Big change because your hosting plan has ended or is set to end. We refunded $3.75 to your card and added $2 back to your account credit. The card refund can take 5–10 business days to show up."
    expect(h.emails.map((e) => e.note)).toEqual([note])
  })

  it('ruling 3 (B1, 10:01): under $0.50 after credit: the credit is used now, the invoice is paid with $0 charged, Stripe moves the rest to the next bill (invoice_too_small); Total Paid counts it when that bill is paid', async () => {
    const sim = (h.sim = createStripeSim({ nowSec: T0 }))
    sim.addCustomer('cus_1', 540) // $5.40 credit: Big change ($5.75) would charge $0.35 today
    sim.addSub({ id: 'sub_1', customer: 'cus_1', step: 'priority', periodStart: T0 - 10 * 86_400 })
    const deps = { stripe: sim.client() as unknown as Stripe, addonPriceIdFor: async (id: AddonId) => SIM_PRICE_ID.addon(id), now: sim.now, log: () => {} }
    const preview = await previewAddonChange(deps, sim.sub('sub_1') as unknown as SubArg, 'big_change', 'on', sim.nowSec())
    expect(preview).toMatchObject({ ok: true, amountDueCents: 35, fullCents: 575, nextAmountCents: 6075 })
    expect(addonAddedToNextBill(35)).toBe('$0.35 will be added to your next bill.')
    const r = await changeAddon(deps, sim.sub('sub_1') as unknown as SubArg, 'big_change', 'on', { userId: USER, prorationDate: sim.nowSec() })
    expect(r).toEqual({ ok: true, kind: 'on', addon: 'big_change', tipDollars: 0, invoiceStatus: 'paid', invoiceId: expect.any(String), deferredCents: 35 })
    // the normal first-period invoice: the credit is used, $0 charged, $0.35 debited to the balance
    const [first] = sim.invoices()
    expect(first).toMatchObject({ status: 'paid', amount_paid: 0, total: 575 })
    expect(sim.customer('cus_1').balance).toBe(35)
    expect(sim.balanceTransactions).toEqual([expect.objectContaining({ customer: 'cus_1', type: 'invoice_too_small', amount: 35, invoice: first.id })])
    expect(addonItems(sim, 'big_change')).toHaveLength(1)
    expect(sim.pendingLines('sub_1')).toEqual([])
    // its invoice.paid books $0 (no ledger row for a $0 payment, nothing in Total Paid)
    const firstPaid = sim.events.find((e) => e.data.object.id === first.id)!
    expect(await deliver(firstPaid)).toBe(200)
    expect(h.ledger.filter((l) => l.amount_cents > 0)).toHaveLength(0)
    expect(h.total).toBe(0)
    // the renewal: $55 + $5.75 = $60.75, plus the $0.35 debit
    sim.advance(21 * 86_400)
    const renewal = sim.events.find((e) => e.data.object.billing_reason === 'subscription_cycle')!
    expect(renewal.data.object).toMatchObject({ total: 6075, amount_paid: 6110 })
    expect(h.total).toBe(0)
    expect(await deliver(renewal)).toBe(200)
    expect(h.ledger.filter((l) => l.amount_cents > 0)).toEqual([expect.objectContaining({ stripe_invoice_id: renewal.data.object.id, amount_cents: 6075 + 35 })])
    expect(h.total).toBe(6110)
    expect(sim.customer('cus_1').balance).toBe(0)
    // a retry of the same request is a replay: still one item, nothing billed twice
    await changeAddon(deps, sim.sub('sub_1') as unknown as SubArg, 'big_change', 'on', { userId: USER, prorationDate: sim.nowSec() })
    expect(addonItems(sim, 'big_change')).toHaveLength(1)
  })

  it('L-1 (Aria 9:57, Sable 10:01): an owed removal + the renewal through the real route: Big change removed, its line refunded once (memo = the reason), email "We refunded your Big change charge.", flag cleared', async () => {
    const sim = (h.sim = createStripeSim({ nowSec: T0 }))
    sim.addCustomer('cus_1')
    const start = T0 - 10 * 86_400
    sim.addSub({ id: 'sub_1', customer: 'cus_1', step: 'priority', addons: ['big_change'], periodStart: start })
    const effectiveAt = new Date((start + 30 * 86_400) * 1000).toISOString()
    h.owed.push({ id: 'ow_1', stripe_subscription_id: 'sub_1', stripe_customer_id: 'cus_1', user_id: USER, addons: ['big_change'], effective_at: effectiveAt, cleared_at: null })
    sim.advance(21 * 86_400)
    const renewal = sim.events.find((e) => e.data.object.billing_reason === 'subscription_cycle')!
    expect(renewal.data.object.total).toBe(6075)
    expect(await deliver(renewal)).toBe(200)
    expect(addonItems(sim, 'big_change')).toHaveLength(0)
    const reason = 'You turned off Big change, but it was still on your latest bill.'
    expect(sim.creditNotes).toEqual([expect.objectContaining({ invoice: renewal.data.object.id, amount: 575, refund_amount: 575, memo: reason })])
    expect(h.emails).toEqual([expect.objectContaining({ addonName: 'Big change', subject: 'We refunded your Big change charge.' })])
    expect(h.emails[0].note.startsWith(reason)).toBe(true)
    expect(h.owed[0]).toMatchObject({ cleared_how: 'refunded', cleared_invoice_id: renewal.data.object.id })
    // the same event again: no second refund, no second email
    expect(await deliver(renewal)).toBe(200)
    expect(sim.creditNotes).toHaveLength(1)
    expect(h.emails).toHaveLength(1)
  })

  it('ruling 3, the edges: exactly $0.50 is charged now; $0 (credit covers all) is a paid $0 invoice, nothing on the next bill', async () => {
    for (const [credit, expectInvoice] of [[525, true], [575, true]] as const) {
      const sim = (h.sim = createStripeSim({ nowSec: T0 }))
      sim.addCustomer('cus_1', credit)
      sim.addSub({ id: 'sub_1', customer: 'cus_1', step: 'priority', periodStart: T0 - 10 * 86_400 })
      const deps = { stripe: sim.client() as unknown as Stripe, addonPriceIdFor: async (id: AddonId) => SIM_PRICE_ID.addon(id), now: sim.now, log: () => {} }
      const r = await changeAddon(deps, sim.sub('sub_1') as unknown as SubArg, 'big_change', 'on', { userId: USER, prorationDate: sim.nowSec() })
      expect(r).toMatchObject({ ok: true, kind: 'on' })
      expect(r).not.toHaveProperty('deferredCents')
      expect(sim.invoices().length > 0).toBe(expectInvoice)
      expect(sim.pendingLines('sub_1')).toEqual([])
      expect(sim.invoices()[0]).toMatchObject({ status: 'paid', amount_paid: 575 - credit })
    }
  })
})
