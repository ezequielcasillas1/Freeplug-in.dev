/**
 * In-memory Stripe stand-in with a SIMULATED test clock, for the add-on self-heal tests (Aria, Oct 4
 * 8:59 AM CT). No real Stripe: every test-mode event on the box reaches the :3000 listener, so the
 * crash-between-pay-and-add case runs here (team rule, Vera and Jace 9:03). Mirrors what the code
 * relies on: invoices (draft -> open -> paid, customer credit applied at finalize, metadata merge),
 * invoice items, subscriptions (item add / quantity / delete, renewals when the clock passes the period
 * end), credit notes (capped at the invoice total; credit back to the balance), Stripe idempotency keys
 * (same key + same params = same result; other params = error) and invoice.paid events.
 * Aria 9:27/9:28 round: add_invoice_items (one-off lines on the NEXT renewal invoice), subscription
 * schedules (create from_subscription / update phases / release; the next phase's items apply at the
 * renewal where it starts), cancel_at_period_end (refused while a schedule is attached, like Stripe; the
 * subscription ends instead of renewing), subscription metadata (merge; '' unsets) and customers.retrieve.
 * A client can "crash" after a named call: every later call from that client throws, nothing runs.
 */
import { ADDONS, PLAN_STEPS, TIP_LOOKUP_KEY, TIP_PRODUCT_ID, type AddonId, type PlanStepId } from '../src/lib/plans/ladder'
import type { PlanChangeLockStore } from '../src/lib/plans/plan-change-lock'

type Price = { id: string; object: 'price'; active: boolean; lookup_key: string; product: string; unit_amount: number; currency: 'usd'; type: 'recurring'; recurring: { interval: 'month'; interval_count: 1 } }
type Item = { id: string; object: 'subscription_item'; price: Price; quantity: number; current_period_start: number; current_period_end: number }
export type SimSub = {
  id: string
  object: 'subscription'
  customer: string
  status: string
  cancel_at_period_end: boolean
  cancel_at: number | null
  schedule: string | null
  latest_invoice: string | null
  default_payment_method: string
  items: { object: 'list'; data: Item[] }
  metadata: Record<string, string>
}
type SimPhase = { start_date: number; end_date: number; items: { price: string; quantity?: number }[]; metadata: Record<string, string> }
export type SimSchedule = {
  id: string
  object: 'subscription_schedule'
  status: 'active' | 'released'
  subscription: string
  customer: string
  test_clock: null
  end_behavior: string
  current_phase: { start_date: number; end_date: number } | null
  phases: SimPhase[]
}
export type SimInvoice = {
  id: string
  object: 'invoice'
  customer: string
  status: 'draft' | 'open' | 'paid' | 'void'
  billing_reason: string
  subscription: string | null
  parent: null | { subscription_details: { subscription: string } }
  lines: { data: { amount: number; description: string; price: Price | null; quantity: number }[] }
  total: number
  amount_due: number
  amount_paid: number
  starting_balance: number
  currency: 'usd'
  metadata: Record<string, string>
  created: number
  status_transitions: { paid_at: number | null }
  post_payment_credit_notes_amount: number
}
export type SimEvent = { id: string; type: 'invoice.paid'; created: number; data: { object: SimInvoice } }

const err = (type: string, message: string, extra: Record<string, unknown> = {}) => Object.assign(new Error(message), { type, ...extra })
export class SimCrash extends Error {
  constructor(after: string) {
    super(`simulated process crash (after ${after})`)
  }
}
const clone = <T>(v: T): T => JSON.parse(JSON.stringify(v)) as T

export const SIM_PRICE_ID = {
  step: (id: PlanStepId) => `price_${id}`,
  addon: (id: AddonId) => `price_addon_${id}`,
  tip: 'price_tip',
}

export function createStripeSim(init: { nowSec: number; credit?: number }) {
  let clock = init.nowSec
  let seq = 0
  const nextId = (p: string) => `${p}_sim${++seq}`
  const price = (id: string, lookup_key: string, product: string, unit_amount: number): Price => ({
    id, object: 'price', active: true, lookup_key, product, unit_amount, currency: 'usd', type: 'recurring', recurring: { interval: 'month', interval_count: 1 },
  })
  const prices = new Map<string, Price>()
  for (const s of PLAN_STEPS) prices.set(SIM_PRICE_ID.step(s.id), price(SIM_PRICE_ID.step(s.id), s.lookupKey, s.productId, s.monthlyCents))
  for (const a of ADDONS) prices.set(SIM_PRICE_ID.addon(a.id), price(SIM_PRICE_ID.addon(a.id), a.lookupKey, a.productId, a.monthlyCents))
  prices.set(SIM_PRICE_ID.tip, price(SIM_PRICE_ID.tip, TIP_LOOKUP_KEY, TIP_PRODUCT_ID, 100))

  const customers = new Map<string, { id: string; balance: number; email: string | null }>()
  const schedules = new Map<string, SimSchedule>()
  /** add_invoice_items waiting for each subscription's next invoice. */
  const pendingLines = new Map<string, { amount: number; description: string }[]>()
  const subs = new Map<string, SimSub>()
  const invoices = new Map<string, SimInvoice>()
  const creditNotes: { id: string; invoice: string; amount: number; refund_amount: number; credit_amount: number }[] = []
  const events: SimEvent[] = []
  const idem = new Map<string, { params: string; result: unknown }>()
  const log: string[] = []
  const periodDays = 30 * 86_400
  const previewAdjust = { cents: 0 }

  function emitPaid(inv: SimInvoice) {
    events.push({ id: nextId('evt'), type: 'invoice.paid', created: clock, data: { object: clone(inv) } })
  }
  function idempotent<T>(key: string | undefined, params: unknown, run: () => T): T {
    if (!key) return run()
    const p = JSON.stringify(params)
    const hit = idem.get(key)
    if (hit) {
      if (hit.params !== p) throw err('StripeIdempotencyError', `Keys for idempotent requests can only be used with the same parameters (${key})`, { statusCode: 400 })
      return clone(hit.result) as T
    }
    const result = run()
    idem.set(key, { params: p, result: clone(result) })
    return result
  }
  function getSub(id: string): SimSub {
    const s = subs.get(id)
    if (!s) throw err('StripeInvalidRequestError', `No such subscription: '${id}'`, { code: 'resource_missing', statusCode: 404 })
    return s
  }
  function getInv(id: string): SimInvoice {
    const i = invoices.get(id)
    if (!i) throw err('StripeInvalidRequestError', `No such invoice: '${id}'`, { code: 'resource_missing', statusCode: 404 })
    return i
  }
  function finalize(inv: SimInvoice) {
    inv.total = inv.lines.data.reduce((n, l) => n + l.amount, 0)
    const cus = customers.get(inv.customer)!
    const credit = cus.balance < 0 ? Math.min(-cus.balance, inv.total) : 0
    cus.balance += credit
    inv.starting_balance = -credit
    inv.amount_due = inv.total - credit
    inv.status = 'open'
    if (inv.amount_due === 0) markPaid(inv)
  }
  function markPaid(inv: SimInvoice) {
    inv.status = 'paid'
    inv.amount_paid = inv.amount_due
    inv.status_transitions.paid_at = clock
    emitPaid(inv)
  }
  function newInvoice(customer: string, extra: Partial<SimInvoice>): SimInvoice {
    const inv: SimInvoice = {
      id: nextId('in'), object: 'invoice', customer, status: 'draft', billing_reason: 'manual', subscription: null, parent: null,
      lines: { data: [] }, total: 0, amount_due: 0, amount_paid: 0, starting_balance: 0, currency: 'usd', metadata: {}, created: clock,
      status_transitions: { paid_at: null }, post_payment_credit_notes_amount: 0, ...extra,
    }
    invoices.set(inv.id, inv)
    return inv
  }

  /** Stripe-shaped client. crashAfter: the named call completes, then this "process" dies. */
  function client(opts: { crashAfter?: string } = {}) {
    let crashed = false
    const call = <T>(name: string, run: () => T): Promise<T> => {
      log.push(name)
      if (crashed) return Promise.reject(new SimCrash(opts.crashAfter!))
      try {
        const out = run()
        if (opts.crashAfter === name) crashed = true
        return Promise.resolve(clone(out))
      } catch (e) {
        return Promise.reject(e)
      }
    }
    type O = { idempotencyKey?: string }
    return {
      subscriptions: {
        retrieve: (id: string) => call('subscriptions.retrieve', () => getSub(id)),
        update: (
          id: string,
          p: {
            items?: { id?: string; price?: string; quantity?: number; deleted?: boolean }[]
            proration_behavior?: string
            add_invoice_items?: { price_data: { currency: string; product: string; unit_amount: number }; quantity?: number }[]
            cancel_at_period_end?: boolean
            cancel_at?: number | ''
            metadata?: Record<string, string>
          },
          o: O = {}
        ) =>
          call('subscriptions.update', () =>
            idempotent(o.idempotencyKey, { id, p }, () => {
              const s = getSub(id)
              if (s.status !== 'active' && s.status !== 'trialing') throw err('StripeInvalidRequestError', `subscription ${id} is ${s.status}`, { statusCode: 400 })
              if (p.cancel_at_period_end === true && s.schedule) throw err('StripeInvalidRequestError', 'subscription is managed by a schedule', { statusCode: 400 })
              if (p.cancel_at_period_end !== undefined) Object.assign(s, { cancel_at_period_end: p.cancel_at_period_end, cancel_at: p.cancel_at_period_end ? s.items.data[0].current_period_end : null })
              if (p.cancel_at === '') Object.assign(s, { cancel_at: null, cancel_at_period_end: false })
              for (const [k, v] of Object.entries(p.metadata ?? {})) {
                if (v === '') delete s.metadata[k]
                else s.metadata[k] = v
              }
              for (const a of p.add_invoice_items ?? []) {
                const list = pendingLines.get(id) ?? []
                list.push({ amount: a.price_data.unit_amount * (a.quantity ?? 1), description: `one-off ${a.price_data.product}` })
                pendingLines.set(id, list)
              }
              for (const it of p.items ?? []) {
                if (it.id && it.deleted) s.items.data = s.items.data.filter((x) => x.id !== it.id)
                else if (it.id) s.items.data.find((x) => x.id === it.id)!.quantity = it.quantity ?? 1
                else {
                  const pr = prices.get(it.price!)
                  if (!pr || !pr.active) throw err('StripeInvalidRequestError', `price ${it.price} is not active`, { statusCode: 400 })
                  if (s.items.data.some((x) => x.price.id === pr.id)) throw err('StripeInvalidRequestError', `price ${pr.id} is already on ${id}`, { statusCode: 400 })
                  const ref = s.items.data[0]
                  s.items.data.push({ id: nextId('si'), object: 'subscription_item', price: clone(pr), quantity: it.quantity ?? 1, current_period_start: ref.current_period_start, current_period_end: ref.current_period_end })
                }
              }
              return s
            })
          ),
      },
      subscriptionSchedules: {
        retrieve: (id: string) =>
          call('subscriptionSchedules.retrieve', () => {
            const sc = schedules.get(id)
            if (!sc) throw err('StripeInvalidRequestError', `No such schedule ${id}`, { code: 'resource_missing', statusCode: 404 })
            return sc
          }),
        create: (p: { from_subscription: string }) =>
          call('subscriptionSchedules.create', () => {
            const s = getSub(p.from_subscription)
            if (s.schedule) throw err('StripeInvalidRequestError', 'subscription already has a schedule', { statusCode: 400 })
            if (s.cancel_at_period_end) throw err('StripeInvalidRequestError', 'subscription is set to cancel', { statusCode: 400 })
            const { current_period_start: start, current_period_end: end } = s.items.data[0]
            const sc: SimSchedule = {
              id: nextId('sub_sched'), object: 'subscription_schedule', status: 'active', subscription: s.id, customer: s.customer, test_clock: null, end_behavior: 'release',
              current_phase: { start_date: start, end_date: end },
              phases: [{ start_date: start, end_date: end, items: s.items.data.map((i) => ({ price: i.price.id, quantity: i.quantity })), metadata: {} }],
            }
            schedules.set(sc.id, sc)
            s.schedule = sc.id
            return sc
          }),
        update: (id: string, p: { phases: { items: { price: string; quantity?: number }[]; start_date?: number; end_date?: number; duration?: unknown; metadata?: Record<string, string> }[]; end_behavior?: string }) =>
          call('subscriptionSchedules.update', () => {
            const sc = schedules.get(id)
            if (!sc || sc.status !== 'active') throw err('StripeInvalidRequestError', `schedule ${id} is not active`, { statusCode: 400 })
            let prevEnd = 0
            sc.phases = p.phases.map((ph) => {
              const start = ph.start_date ?? prevEnd
              const end = ph.end_date ?? start + periodDays
              prevEnd = end
              return { start_date: start, end_date: end, items: ph.items.map((i) => ({ price: i.price, quantity: i.quantity ?? 1 })), metadata: { ...(ph.metadata ?? {}) } }
            })
            if (p.end_behavior) sc.end_behavior = p.end_behavior
            return sc
          }),
        release: (id: string) =>
          call('subscriptionSchedules.release', () => {
            const sc = schedules.get(id)
            if (!sc || sc.status !== 'active') throw err('StripeInvalidRequestError', `schedule ${id} is not active`, { statusCode: 400 })
            sc.status = 'released'
            const s = subs.get(sc.subscription)
            if (s && s.schedule === id) s.schedule = null
            return sc
          }),
      },
      customers: {
        retrieve: (id: string) => call('customers.retrieve', () => ({ object: 'customer', ...customers.get(id)! })),
      },
      prices: { retrieve: (id: string) => call('prices.retrieve', () => prices.get(id)!) },
      invoices: {
        create: (p: { customer: string; metadata?: Record<string, string>; description?: string }, o: O = {}) =>
          call('invoices.create', () => idempotent(o.idempotencyKey, p, () => newInvoice(p.customer, { metadata: { ...(p.metadata ?? {}) } }))),
        finalizeInvoice: (id: string, p: unknown, o: O = {}) =>
          call('invoices.finalize', () =>
            idempotent(o.idempotencyKey, { id, p }, () => {
              const inv = getInv(id)
              if (inv.status === 'draft') finalize(inv)
              return inv
            })
          ),
        pay: (id: string, p: unknown, o: O = {}) =>
          call('invoices.pay', () =>
            idempotent(o.idempotencyKey, { id, p }, () => {
              const inv = getInv(id)
              if (inv.status === 'open') markPaid(inv)
              return inv
            })
          ),
        retrieve: (id: string) => call('invoices.retrieve', () => getInv(id)),
        list: (p: { customer: string; limit?: number }) =>
          call('invoices.list', () => ({
            object: 'list',
            has_more: false,
            data: [...invoices.values()].filter((i) => i.customer === p.customer).sort((x, y) => y.created - x.created || (y.id > x.id ? 1 : -1)).slice(0, p.limit ?? 10),
          })),
        update: (id: string, p: { metadata?: Record<string, string> }) =>
          call('invoices.update', () => {
            const inv = getInv(id)
            inv.metadata = { ...inv.metadata, ...(p.metadata ?? {}) }
            return inv
          }),
        voidInvoice: (id: string) => call('invoices.void', () => Object.assign(getInv(id), { status: 'void' as const })),
        del: (id: string) => call('invoices.del', () => (invoices.delete(id), { id, deleted: true })),
        createPreview: (p: { customer: string; subscription_details?: { items?: { price: string }[] } }) =>
          call('invoices.createPreview', () => {
            const total = (p.subscription_details?.items ?? []).reduce((n, i) => n + prices.get(i.price)!.unit_amount, 0) + previewAdjust.cents
            const bal = customers.get(p.customer)!.balance
            const credit = bal < 0 ? Math.min(-bal, total) : 0
            return { object: 'invoice', total, amount_due: total - credit, starting_balance: -credit, currency: 'usd' }
          }),
      },
      invoiceItems: {
        create: (p: { invoice: string; amount: number; description: string }, o: O = {}) =>
          call('invoiceItems.create', () =>
            idempotent(o.idempotencyKey, p, () => {
              getInv(p.invoice).lines.data.push({ amount: p.amount, description: p.description, price: null, quantity: 1 })
              return { id: nextId('ii') }
            })
          ),
      },
      creditNotes: {
        create: (p: { invoice: string; amount: number; refund_amount?: number; credit_amount?: number }, o: O = {}) =>
          call('creditNotes.create', () =>
            idempotent(o.idempotencyKey, p, () => {
              const inv = getInv(p.invoice)
              if (inv.post_payment_credit_notes_amount + p.amount > inv.total) throw err('StripeInvalidRequestError', 'credit note exceeds the invoice total', { statusCode: 400 })
              const refund = p.refund_amount ?? 0
              const credit = p.credit_amount ?? 0
              if (refund + credit !== p.amount) throw err('StripeInvalidRequestError', 'refund + credit must equal the amount', { statusCode: 400 })
              inv.post_payment_credit_notes_amount += p.amount
              customers.get(inv.customer)!.balance -= credit
              const cn = { id: nextId('cn'), invoice: inv.id, amount: p.amount, refund_amount: refund, credit_amount: credit }
              creditNotes.push(cn)
              return cn
            })
          ),
      },
    }
  }

  function addCustomer(id: string, credit = 0, email: string | null = `${id}@sim.invalid`) {
    customers.set(id, { id, balance: -credit, email })
  }
  function addSub(o: { id: string; customer: string; step: PlanStepId; addons?: AddonId[]; tip?: number; periodStart: number }) {
    const end = o.periodStart + periodDays
    const mk = (priceId: string, quantity = 1): Item => ({ id: nextId('si'), object: 'subscription_item', price: clone(prices.get(priceId)!), quantity, current_period_start: o.periodStart, current_period_end: end })
    const items = [mk(SIM_PRICE_ID.step(o.step)), ...(o.addons ?? []).map((a) => mk(SIM_PRICE_ID.addon(a)))]
    if (o.tip) items.push(mk(SIM_PRICE_ID.tip, o.tip))
    const s: SimSub = {
      id: o.id, object: 'subscription', customer: o.customer, status: 'active', cancel_at_period_end: false, cancel_at: null, schedule: null,
      latest_invoice: null, default_payment_method: 'pm_sim', items: { object: 'list', data: items }, metadata: {},
    }
    subs.set(s.id, s)
    return s
  }
  /** The simulated test clock: move forward; every subscription whose period ended renews (invoice + invoice.paid). */
  function advance(seconds: number) {
    clock += seconds
    for (const s of subs.values()) {
      if (s.status !== 'active') continue
      while (s.status === 'active' && s.items.data[0].current_period_end <= clock) {
        const start = s.items.data[0].current_period_end
        // Set to end: the subscription ends at the period end; nothing renews, nothing is invoiced.
        if (s.cancel_at_period_end) {
          s.status = 'canceled'
          break
        }
        // A schedule phase starting now: its items replace the subscription's (like Stripe's phase change).
        const sc = s.schedule ? schedules.get(s.schedule) : undefined
        const phase = sc?.status === 'active' ? sc.phases.find((ph) => ph.start_date === start) : undefined
        if (sc && phase) {
          const old = s.items.data
          s.items.data = phase.items.map((pi) => {
            const pr = prices.get(pi.price)!
            const keep = old.find((x) => x.price.id === pr.id)
            return { id: keep?.id ?? nextId('si'), object: 'subscription_item', price: clone(pr), quantity: pi.quantity ?? 1, current_period_start: start, current_period_end: start + periodDays }
          })
          sc.current_phase = { start_date: phase.start_date, end_date: phase.end_date }
          Object.assign(s.metadata, phase.metadata)
        }
        for (const it of s.items.data) Object.assign(it, { current_period_start: start, current_period_end: start + periodDays })
        const inv = newInvoice(s.customer, { billing_reason: 'subscription_cycle', subscription: s.id, parent: { subscription_details: { subscription: s.id } }, created: start })
        inv.lines.data = s.items.data.map((it) => ({ amount: it.price.unit_amount * it.quantity, description: it.price.lookup_key, price: clone(it.price), quantity: it.quantity }))
        // add_invoice_items from the last period ride on this invoice (then they're gone).
        for (const l of pendingLines.get(s.id) ?? []) inv.lines.data.push({ amount: l.amount, description: l.description, price: null, quantity: 1 })
        pendingLines.delete(s.id)
        s.latest_invoice = inv.id
        finalize(inv)
        if (inv.status === 'open') markPaid(inv)
      }
    }
  }
  /** plan_change_locks on the simulated clock (same rules as plan_change_lock_claim / _release). */
  const locks = new Map<string, { claim: string; expires: number }>()
  const lockStore: PlanChangeLockStore = {
    async claim(userId, ttl) {
      const row = locks.get(userId)
      if (row && row.expires > clock) return null
      const claim = nextId('claim')
      locks.set(userId, { claim, expires: clock + ttl })
      return claim
    },
    async release(userId, claimId) {
      if (locks.get(userId)?.claim === claimId) locks.delete(userId)
    },
  }
  return {
    client,
    addCustomer,
    addSub,
    advance,
    lockStore,
    now: () => new Date(clock * 1000),
    nowSec: () => clock,
    sub: (id: string) => clone(getSub(id)),
    invoice: (id: string) => clone(getInv(id)),
    invoices: () => [...invoices.values()].map(clone),
    customer: (id: string) => ({ ...customers.get(id)! }),
    creditNotes,
    events,
    log,
    cancel: (id: string) => Object.assign(getSub(id), { status: 'canceled' }),
    archivePrice: (id: string) => Object.assign(prices.get(id)!, { active: false }),
    setSchedule: (id: string, schedule: string) => Object.assign(getSub(id), { schedule }),
    schedule: (id: string) => clone(schedules.get(id) ?? null),
    pendingLines: (subId: string) => clone(pendingLines.get(subId) ?? []),
    /** A coupon or tax on the account: every add-on preview total moves by `cents` (Aria 9:27 refusal). */
    setPreviewAdjustment: (cents: number) => void (previewAdjust.cents = cents),
  }
}
export type StripeSim = ReturnType<typeof createStripeSim>
