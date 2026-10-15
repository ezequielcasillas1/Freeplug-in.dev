#!/usr/bin/env node
/**
 * Schedule lifecycle regression on Stripe TEST CLOCKS (Aria, Oct 3 3:43 PM; Vera round 5 B4b/B4c).
 *
 *   node scripts/stripe-testclock-schedule-regression.mjs --env-file <file with STRIPE_SECRET_KEY=sk_test_...> [--keep]
 *        [--addons]       also run the add-on cases (Clock E, below)
 *        [--addons-only]  run ONLY the add-on cases
 *
 * Uses the app's own code (src/lib/stripe/change-plan.ts, billing-routing.ts) with now = the clock's
 * frozen time. Every customer lives on a test clock created here (metadata.probe=true) and the clocks
 * are deleted at the end (which deletes their customers and subscriptions) unless --keep is given.
 *
 *   Clock A  E1  Fast lane + $6 -> Priority, pass the switch, -> Starter: no snap-back, no extra charge,
 *               Starter (and no tip) at the next switch
 *            E2  same start, upgrade to Fast lane right after the switch (preview == invoice)
 *            E3  same start, tip change right after the switch
 *   Clock B  E4  cancel while a switch is still ahead (schedule attached)
 *            E5  Manage billing right after the switch (no ?billing=pending)
 *            E6  the webhook path: Stripe's subscription_schedule.updated at the switch -> released
 *   Clock C  E7  cancel right after the switch, with the finished schedule still attached
 *   Clock D  E8  the clock LAGS wall time: a wall date past the switch, the clock before it -> still
 *               pending, nothing released (the app decides on the subscription's clock)
 *
 *   Clock E  (add-ons, Aria Oct 4 8:28 AM: full price on turn-on, removal at period end)
 *            E9   Priority, clock moved to 2 days before the renewal, turn on Big change: exactly 575
 *                 charged now on its own invoice (no proration lines, no pending items); at the
 *                 renewal the cycle invoice is 5500 + 575 (the normal monthly amount)
 *            E10  same for +1 small edit: exactly 500 now, renewal 5500 + 500
 *            E11  Priority + both add-ons, turn Big change off: still on until the renewal; the cycle
 *                 invoice is 5500 + 500 and Big change is gone after it
 *            E12  declined card (pm_card_chargeCustomerFail as the plan's card): payment_failed, the
 *                 add-on stays off, the one-off invoice is voided, nothing pending
 *            E13  Starter + $19 tip, turn on +1 small edit with the confirmed drop to $14: 500 now,
 *                 renewal 3500 + 500 + 1400 = 5400 ($54)
 *
 * Next round (Vera/Aria): the app now reads the subscription's test clock itself (frozen_time) and
 * Stripe's current_phase, so E5, E6 and the E1 lazy read pass WALL time (a month behind the
 * advanced clocks): the clock running ahead of wall time must still release the finished schedule.
 *
 * TEST MODE ONLY: the key comes from the --env-file, is checked to be sk_test_/rk_test_, is never
 * printed, and every object Stripe returns must be livemode=false.
 */
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { assertTestKey, assertTestObject, readKeyFromEnvFile, redact, BOT_SECRET_VARS } from './stripe-test-setup-ladder.mjs'

const here = path.dirname(fileURLToPath(import.meta.url))
const TAG = { freeplug_probe: 'schedule-lifecycle-2026-10-03', probe: 'true' }
const clocks = []
let client = null
let keep = false

async function main(argv) {
  for (const k of BOT_SECRET_VARS) delete process.env[k]
  const arg = (n) => (argv.indexOf(n) >= 0 ? argv[argv.indexOf(n) + 1] : undefined)
  const key = readKeyFromEnvFile(arg('--env-file'))
  assertTestKey(key)
  const { default: Stripe } = await import('stripe')
  const stripe = new Stripe(key, { maxNetworkRetries: 2 })
  client = stripe
  keep = argv.includes('--keep')
  const { createJiti } = await import('jiti')
  const jiti = createJiti(import.meta.url)
  const cp = await jiti.import(path.join(here, '..', 'src', 'lib', 'stripe', 'change-plan.ts'))
  const routing = await jiti.import(path.join(here, '..', 'src', 'lib', 'stripe', 'billing-routing.ts'))
  const ladder = await jiti.import(path.join(here, '..', 'src', 'lib', 'plans', 'ladder.ts'))

  const lookups = [...ladder.PLAN_STEPS.map((s) => s.lookupKey), ladder.TIP_LOOKUP_KEY, ...ladder.ADDONS.map((a) => a.lookupKey)]
  const prices = (await stripe.prices.list({ lookup_keys: lookups, active: true, limit: 20 })).data
  for (const p of prices) assertTestObject(p, 'price')
  const priceByKey = Object.fromEntries(prices.map((p) => [p.lookup_key, p.id]))
  const priceIdFor = async (id) => priceByKey[ladder.PLAN_STEPS.find((s) => s.id === id).lookupKey]
  const tipPrice = priceByKey[ladder.TIP_LOOKUP_KEY]

  const lk = (sub) => sub.items.data.map((i) => `${i.price.lookup_key ?? i.price.id} x${i.quantity}`).join(' + ')
  const iso = (t) => (t ? new Date(t * 1000).toISOString().slice(0, 16) + 'Z' : null)
  const out = { startedAt: new Date().toISOString(), checks: {} }
  const check = (name, ok, detail) => {
    out.checks[name] = { ok: !!ok, ...(detail === undefined ? {} : { detail }) }
    console.log(`${ok ? 'PASS' : 'FAIL'}  ${name}${detail === undefined ? '' : `  ${JSON.stringify(detail)}`}`)
  }

  const newClock = async (name) => {
    const c = assertTestObject(await stripe.testHelpers.testClocks.create({ frozen_time: Math.floor(Date.now() / 1000), name }), 'test clock')
    clocks.push(c.id)
    return c
  }
  const clockNow = async (id) => new Date((await stripe.testHelpers.testClocks.retrieve(id)).frozen_time * 1000)
  const advance = async (id, to) => {
    await stripe.testHelpers.testClocks.advance(id, { frozen_time: to })
    for (let i = 0; i < 120; i++) {
      const c = await stripe.testHelpers.testClocks.retrieve(id)
      if (c.status === 'ready') return c
      if (c.status === 'internal_failure') throw new Error(`clock ${id} failed`)
      await new Promise((r) => setTimeout(r, 2000))
    }
    throw new Error(`clock ${id} did not finish advancing`)
  }
  const fresh = (id) => stripe.subscriptions.retrieve(id)
  const periodEnd = (sub) => sub.items.data[0].current_period_end

  /** Fast lane + $6 on a clock customer, then "Switch to Priority" (a downgrade at period end). */
  const startE = async (clock, n) => {
    const customer = assertTestObject(await stripe.customers.create({ test_clock: clock.id, email: `schedule-${n}@example.test`, name: `Schedule ${n}`, metadata: TAG }), 'customer')
    const pm = await stripe.paymentMethods.attach('pm_card_visa', { customer: customer.id })
    await stripe.customers.update(customer.id, { invoice_settings: { default_payment_method: pm.id } })
    // the plan item first (Aria 3:43 PM, C)
    const sub = assertTestObject(
      await stripe.subscriptions.create({ customer: customer.id, items: [{ price: await priceIdFor('fast_lane') }, { price: tipPrice, quantity: 6 }], metadata: { ...TAG, type: 'hosting' } }),
      'subscription'
    )
    const now = await clockNow(clock.id)
    const down = await cp.changePlanStep({ stripe, priceIdFor, now: () => now }, await fresh(sub.id), 'priority')
    return { customer: customer.id, sub: sub.id, down, switchAt: periodEnd(sub) }
  }
  const invoicesOf = async (customer) =>
    (await stripe.invoices.list({ customer, limit: 20 })).data.map((i) => ({ reason: i.billing_reason, status: i.status, amount_due: i.amount_due, lines: i.lines.data.map((l) => [l.description, l.amount]) }))
  const pendingItems = async (customer) => (await stripe.invoiceItems.list({ customer, pending: true, limit: 20 })).data.map((ii) => [ii.description, ii.amount])

  const addonCtx = { stripe, cp, ladder, priceIdFor, priceByKey, tipPrice, check, newClock, clockNow, advance, fresh, periodEnd, invoicesOf, pendingItems, lk }
  if (argv.includes('--addons') || argv.includes('--addons-only')) await runAddonCases(addonCtx)
  if (argv.includes('--addons-only')) return finish(stripe, out, argv)

  const A = await newClock('schedule lifecycle A')
  const B = await newClock('schedule lifecycle B')
  const C = await newClock('schedule lifecycle C')
  const D = await newClock('schedule lifecycle D')
  const [e1, e2, e3, e4, e5, e6, e7, e8] = await Promise.all([startE(A, 'e1'), startE(A, 'e2'), startE(A, 'e3'), startE(B, 'e4'), startE(B, 'e5'), startE(B, 'e6'), startE(C, 'e7'), startE(D, 'e8')])
  for (const [n, e] of Object.entries({ e1, e2, e3, e4, e5, e6, e7, e8 })) check(`${n} Fast lane + $6 -> Priority is scheduled for the switch date`, e.down.ok && e.down.kind === 'scheduled' && e.down.step === 'priority', { effectiveAt: e.down.effectiveAt })

  // E4: cancel while the switch is still ahead (schedule attached, phase 2 in the future)
  {
    const nowB = await clockNow(B.id)
    const before = await fresh(e4.sub)
    const c = await cp.cancelPlanAtPeriodEnd(stripe, before, nowB)
    const after = await fresh(e4.sub)
    check('E4 cancel with a switch ahead: schedule released first, then cancel_at_period_end', c.ok && c.kind === 'canceled' && after.schedule === null && after.cancel_at_period_end === true, {
      clearedPendingChange: c.clearedPendingChange?.step ?? null,
      items: lk(after),
      invoices: (await invoicesOf(e4.customer)).length,
    })
  }

  // E8: clock D is never advanced; a wall date 5 days past the switch must not release the schedule
  {
    const s = await fresh(e8.sub)
    const sched = await stripe.subscriptionSchedules.retrieve(s.schedule)
    const lagWall = new Date((e8.switchAt + 5 * 86400) * 1000)
    const clockD = await clockNow(D.id)
    const outcome = await cp.releaseScheduleIfSwitched(stripe, s.schedule, lagWall)
    const pending = await cp.pendingPlanChange(stripe, s, lagWall)
    const found = await routing.findScheduledSubscription(stripe, e8.customer, lagWall)
    const after = await fresh(e8.sub)
    check('E8 clock LAGS wall time (wall 5 days past the switch, clock before it): pending, Priority still ahead, schedule kept', sched.test_clock === D.id && outcome === 'pending' && pending?.step === 'priority' && found?.scheduleId === s.schedule && after.schedule === s.schedule, {
      wall: lagWall.toISOString(),
      clock: clockD.toISOString(),
      switchAt: iso(e8.switchAt),
      scheduleTestClock: sched.test_clock === D.id,
      outcome,
      pending: pending ? { step: pending.step, effectiveAt: pending.effectiveAt } : null,
      scheduleAfter: after.schedule,
    })
  }

  // Pass the switch date on every clock (+1 h)
  const switchAt = e1.switchAt
  await Promise.all([advance(A.id, switchAt + 3600), advance(B.id, switchAt + 3600), advance(C.id, e7.switchAt + 3600)])
  const nowA = await clockNow(A.id)
  const nowB = await clockNow(B.id)
  const nowC = await clockNow(C.id)
  out.clockAfterSwitch = nowA.toISOString()

  // E1: Vera B4c: Priority now, the finished schedule still attached; downgrade to Starter
  {
    const s = await fresh(e1.sub)
    const invBefore = await invoicesOf(e1.customer)
    check('E1 after the switch: Priority only, tip dropped, the finished schedule still attached (nothing released it yet)', lk(s) === 'freeplug_step_priority_monthly x1' && !!s.schedule, {
      items: lk(s),
      schedule: s.schedule,
      cycleInvoice: invBefore.find((i) => i.reason === 'subscription_cycle'),
    })
    const r = await cp.changePlanStep({ stripe, priceIdFor, now: () => nowA }, s, 'starter')
    const after = await fresh(e1.sub)
    const sched = after.schedule ? await stripe.subscriptionSchedules.retrieve(after.schedule) : null
    const invAfter = await invoicesOf(e1.customer)
    const pend = await pendingItems(e1.customer)
    const preview = await stripe.invoices.createPreview({ subscription: e1.sub })
    check('E1 -> Starter: scheduled for the next switch', r.ok && r.kind === 'scheduled' && r.step === 'starter', r)
    check('E1 no snap-back: the subscription stays Priority x1 until the next switch', lk(after) === 'freeplug_step_priority_monthly x1', { items: lk(after) })
    check('E1 no extra charge: no new invoice and no pending proration items', invAfter.length === invBefore.length && pend.length === 0, { newInvoices: invAfter.length - invBefore.length, pendingItems: pend })
    check('E1 the old schedule was released and a new one holds [Priority now, Starter next]', !!sched && sched.id !== s.schedule && sched.phases.length === 2, {
      oldSchedule: s.schedule,
      newSchedule: sched?.id,
      phases: sched?.phases.map((p) => [iso(p.start_date), iso(p.end_date), p.items.map((i) => `${typeof i.price === 'string' ? i.price : i.price.id} x${i.quantity}`).join(' + ')]),
    })
    check('E1 next invoice = Starter $35 (no tip, no proration)', preview.amount_due === 3500, { amount_due: preview.amount_due, lines: preview.lines.data.map((l) => [l.description, l.amount]) })
    out.e1 = { sub: e1.sub, newSchedule: sched?.id ?? null, nextSwitch: sched ? iso(sched.phases[1].start_date) : null }
  }

  // E2: upgrade right after the switch (the finished schedule still attached)
  {
    const s = await fresh(e2.sub)
    const prorationDate = Math.floor(nowA.getTime() / 1000)
    const p = await cp.previewPlanStepChange({ stripe, priceIdFor }, s, 'fast_lane', prorationDate)
    const r = await cp.changePlanStep({ stripe, priceIdFor, now: () => nowA }, s, 'fast_lane', { prorationDate, userId: 'clock-e2' })
    const after = await stripe.subscriptions.retrieve(e2.sub, { expand: ['latest_invoice'] })
    const inv = after.latest_invoice
    check('E2 upgrade right after the switch: applied now, finished schedule released, charged = preview', r.ok && r.kind === 'upgraded' && after.schedule === null && lk(after) === 'freeplug_step_fast_lane_monthly x1' && inv.amount_paid === p.amountDueCents, {
      result: r,
      preview: p.ok ? p.amountDueCents : p,
      invoice: { reason: inv.billing_reason, status: inv.status, amount_paid: inv.amount_paid },
      items: lk(after),
    })
  }

  // E3: tip change right after the switch
  {
    const s = await fresh(e3.sub)
    const pv = await cp.previewTipChange({ stripe, tipPriceId: async () => tipPrice }, s, 4, nowA)
    const s2 = await fresh(e3.sub)
    const r = await cp.changeTip({ stripe, tipPriceId: async () => tipPrice }, s2, 4, { userId: 'clock-e3', now: nowA, confirmId: 'clock-e3-confirm-1' })
    const after = await fresh(e3.sub)
    const invs = await invoicesOf(e3.customer)
    check('E3 tip preview right after the switch: allowed, next bill $59', pv.ok && pv.nextAmountCents === 5900, pv)
    check('E3 tip change right after the switch: applied, plan item first, nothing charged today', r.ok && r.kind === 'changed' && lk(after) === 'freeplug_step_priority_monthly x1 + freeplug_tip_monthly x4' && after.schedule === null, {
      result: r,
      items: lk(after),
      invoices: invs.map((i) => [i.reason, i.amount_due]),
    })
  }

  // E5: Manage billing right after the switch (wall time: the clock runs a month ahead of it)
  {
    const s = await fresh(e5.sub)
    const wall = new Date()
    const found = await routing.findScheduledSubscription(stripe, e5.customer, wall)
    const after = await fresh(e5.sub)
    check('E5 Manage billing right after the switch, WALL time (clock ahead): no ?billing=pending (portal), finished schedule released', found === null && !!s.schedule && after.schedule === null && wall.getTime() < switchAt * 1000, { wall: wall.toISOString(), clock: nowB.toISOString(), scheduleBefore: s.schedule, found, scheduleAfter: after.schedule })
  }

  // E6: the webhook path, with the events Stripe really sent at the switch. Stripe sends no
  // subscription_schedule.updated for the phase change (checked here), so the webhook releases from
  // customer.subscription.updated and invoice.paid (route.ts); this runs the same helper calls.
  {
    const s = await fresh(e6.sub)
    // Events can show up a few seconds after the clock is ready: poll up to ~45 s.
    let mine = []
    let subUpdated = null
    let cyclePaid = null
    for (let i = 0; i < 15 && !(subUpdated && cyclePaid); i++) {
      if (i > 0) await new Promise((r) => setTimeout(r, 3000))
      const recent = []
      for await (const ev of stripe.events.list({ limit: 100, created: { gte: Math.floor(Date.now() / 1000) - 3600 } })) recent.push(ev)
      mine = recent.filter((ev) => [ev.data.object.id, ev.data.object.subscription, ev.data.object.parent?.subscription_details?.subscription].includes(e6.sub) || ev.data.object.id === s.schedule)
      subUpdated = mine.find((ev) => ev.type === 'customer.subscription.updated' && ev.data.object.schedule && ev.data.object.items.data.some((it) => it.price.lookup_key === 'freeplug_step_priority_monthly')) ?? null
      cyclePaid = mine.find((ev) => ev.type === 'invoice.paid' && ev.data.object.billing_reason === 'subscription_cycle') ?? null
    }
    const types = mine.map((ev) => ev.type)
    const schedAtSwitch = mine.filter((ev) => ev.type === 'subscription_schedule.updated' && ev.data.object.current_phase?.start_date >= switchAt)
    check('E6 at the switch Stripe sent customer.subscription.updated and invoice.paid (no subscription_schedule.updated)', !!subUpdated && !!cyclePaid, {
      types: [...new Set(types)],
      scheduleUpdatedAtSwitch: schedAtSwitch.length,
    })
    // route.ts, customer.subscription.updated with sub.schedule set; route.ts passes no now (wall time):
    const fromSubEvent = subUpdated ? subUpdated.data.object.schedule : null
    const outcome = fromSubEvent ? await cp.releaseScheduleIfSwitched(stripe, typeof fromSubEvent === 'string' ? fromSubEvent : fromSubEvent.id) : 'no-event'
    const after = await fresh(e6.sub)
    check('E6 the webhook release (customer.subscription.updated path, wall time as route.ts) releases the finished schedule', outcome === 'released' && after.schedule === null, { outcome, scheduleAfter: after.schedule })
    // invoice.paid path on an already released schedule: nothing to do
    const again = await cp.releaseScheduleIfSwitched(stripe, s.schedule)
    check('E6 the invoice.paid path afterwards finds it already released (closed), no error', again === 'closed', { again })
  }

  // E7: cancel right after the switch, the finished schedule still attached
  {
    const s = await fresh(e7.sub)
    const c = await cp.cancelPlanAtPeriodEnd(stripe, s, nowC)
    const after = await fresh(e7.sub)
    check('E7 cancel with the finished schedule attached: released, then cancel_at_period_end (no Stripe refusal)', !!s.schedule && c.ok && c.kind === 'canceled' && c.clearedPendingChange === null && after.schedule === null && after.cancel_at_period_end === true, {
      scheduleBefore: s.schedule,
      result: c,
      cancelAtPeriodEnd: after.cancel_at_period_end,
    })
  }

  // Clock A, next switch: E1 lands on Starter with no tip
  {
    const s = await fresh(e1.sub)
    await advance(A.id, periodEnd(s) + 3600)
    const nowA2 = await clockNow(A.id)
    const after = await fresh(e1.sub)
    const cycle = (await invoicesOf(e1.customer)).filter((i) => i.reason === 'subscription_cycle')
    const step = cp.currentLadderStep(after)
    const pending = await cp.pendingPlanChange(stripe, after, new Date()) // wall time, clock ~2 months ahead
    const released = await fresh(e1.sub)
    check('E1 at the next switch: Starter x1, tip $0, charged $35 (Starter perks follow plan_step = starter)', lk(after) === 'freeplug_step_starter_monthly x1' && step?.id === 'starter' && cp.subscriptionTipDollars(after) === 0 && cycle[0]?.amount_due === 3500, {
      items: lk(after),
      step: step?.id,
      perks: step ? { name: step.name, monthlyCents: step.monthlyCents } : null,
      cycleInvoices: cycle.map((i) => [i.amount_due, i.lines]),
    })
    check('E1 the next read releases that schedule too (lazy release, WALL time; clock ahead)', pending === null && released.schedule === null, { clock: nowA2.toISOString(), scheduleBefore: after.schedule, scheduleAfter: released.schedule })
  }

  await finish(stripe, out, argv)
}

async function finish(stripe, out, argv) {
  out.passed = Object.values(out.checks).filter((c) => c.ok).length
  out.failed = Object.values(out.checks).filter((c) => !c.ok).length
  out.clocks = clocks
  if (!argv.includes('--keep')) {
    for (const id of clocks) await stripe.testHelpers.testClocks.del(id)
    out.cleanup = `deleted ${clocks.length} test clocks (and their customers/subscriptions)`
  }
  console.log(JSON.stringify({ passed: out.passed, failed: out.failed, clocks: out.clocks, cleanup: out.cleanup ?? 'kept', clockAfterSwitch: out.clockAfterSwitch, e1: out.e1 }, null, 2))
  if (out.failed > 0) process.exitCode = 1
}

/** Clock E: the add-on cases (see the header). Uses the app's changeAddon with now = the clock's time. */
async function runAddonCases({ stripe, cp, ladder, priceIdFor, priceByKey, tipPrice, check, newClock, clockNow, advance, fresh, periodEnd, invoicesOf, pendingItems, lk }) {
  const addonPrice = Object.fromEntries(ladder.ADDONS.map((a) => [a.id, priceByKey[a.lookupKey]]))
  const addonPriceIdFor = async (id) => {
    if (!addonPrice[id]) throw new Error(`add-on price ${id} missing: run stripe-test-setup-ladder.mjs --addons-only first`)
    return addonPrice[id]
  }
  const E = await newClock('add-ons E')
  const start = async (n, step, { addons = [], tip = 0 } = {}) => {
    const customer = assertTestObject(await stripe.customers.create({ test_clock: E.id, email: `addons-${n}@example.test`, name: `Add-ons ${n}`, metadata: TAG }), 'customer')
    const pm = await stripe.paymentMethods.attach('pm_card_visa', { customer: customer.id })
    await stripe.customers.update(customer.id, { invoice_settings: { default_payment_method: pm.id } })
    const items = [{ price: await priceIdFor(step) }, ...addons.map((a) => ({ price: addonPrice[a] })), ...(tip ? [{ price: tipPrice, quantity: tip }] : [])]
    const sub = assertTestObject(await stripe.subscriptions.create({ customer: customer.id, items, default_payment_method: pm.id, metadata: { ...TAG, type: 'hosting' } }), 'subscription')
    return { customer: customer.id, sub: sub.id, renewal: periodEnd(sub) }
  }
  const [e9, e10, e11, e12, e13] = await Promise.all([
    start('e9', 'priority'),
    start('e10', 'priority'),
    start('e11', 'priority', { addons: ['small_edit', 'big_change'] }),
    start('e12', 'priority'),
    start('e13', 'starter', { tip: 19 }),
  ])
  // Late in the period: 2 days before the renewal.
  await advance(E.id, e9.renewal - 2 * 86400)
  const late = await clockNow(E.id)
  const deps = { stripe, addonPriceIdFor, now: () => late, log: (m) => console.log(`  [app] ${m}`) }

  const turnOn = async (e, id, cents, opts = {}) => {
    const before = await invoicesOf(e.customer)
    const r = await cp.changeAddon(deps, await fresh(e.sub), id, 'on', { userId: `clock-${id}`, ...opts })
    const after = await fresh(e.sub)
    const invs = await invoicesOf(e.customer)
    const newOnes = invs.slice(0, invs.length - before.length)
    const pend = await pendingItems(e.customer)
    check(`${id} on 2 days before the renewal: exactly ${cents} charged now on its own invoice, no proration, nothing pending`, r.ok && newOnes.length === 1 && newOnes[0].status === 'paid' && newOnes[0].amount_due === cents && newOnes[0].lines.length === 1 && pend.length === 0 && cp.subscriptionAddons(after).ids.includes(id), {
      result: r,
      newInvoices: newOnes,
      pendingItems: pend,
      items: lk(after),
    })
    return r
  }
  await turnOn(e9, 'big_change', 575)
  await turnOn(e10, 'small_edit', 500)
  await turnOn(e13, 'small_edit', 500, { tipDropTo: 14 })

  // E11: removal at period end
  {
    const r = await cp.changeAddon(deps, await fresh(e11.sub), 'big_change', 'off')
    const s = await fresh(e11.sub)
    check('E11 Big change off: removal scheduled for the renewal, still on now, nothing charged or credited', r.ok && r.kind === 'removal_scheduled' && cp.subscriptionAddons(s).ids.includes('big_change') && (await pendingItems(e11.customer)).length === 0, { result: r, items: lk(s) })
  }

  // E12: declined card on the plan's card
  {
    const bad = await stripe.paymentMethods.attach('pm_card_chargeCustomerFail', { customer: e12.customer })
    await stripe.subscriptions.update(e12.sub, { default_payment_method: bad.id })
    const before = await invoicesOf(e12.customer)
    const r = await cp.changeAddon(deps, await fresh(e12.sub), 'big_change', 'on', { userId: 'clock-e12' })
    const s = await fresh(e12.sub)
    const invs = await invoicesOf(e12.customer)
    const newOnes = invs.slice(0, invs.length - before.length)
    check('E12 declined card: payment_failed, add-on still off, the one-off invoice voided, nothing pending', !r.ok && r.code === 'payment_failed' && !cp.subscriptionAddons(s).ids.includes('big_change') && newOnes.every((i) => i.status === 'void') && (await pendingItems(e12.customer)).length === 0, { result: r, newInvoices: newOnes, items: lk(s) })
  }

  // Past the renewal: normal monthly amounts
  await advance(E.id, e9.renewal + 3600)
  const cycle = async (e) => (await invoicesOf(e.customer)).find((i) => i.reason === 'subscription_cycle')
  const c9 = await cycle(e9)
  const c10 = await cycle(e10)
  const c11 = await cycle(e11)
  const c13 = await cycle(e13)
  check('E9 renewal after turning Big change on: 5500 + 575 (the normal monthly amount, no proration)', c9?.amount_due === 6075, c9)
  check('E10 renewal after turning +1 small edit on: 5500 + 500', c10?.amount_due === 6000, c10)
  const s11 = await fresh(e11.sub)
  check('E11 renewal after the removal: 5500 + 500, Big change gone', c11?.amount_due === 6000 && !cp.subscriptionAddons(s11).ids.includes('big_change'), { cycle: c11, items: lk(s11) })
  check('E13 Starter renewal with +1 small edit and the tip dropped to $14: 5400 ($54 cap)', c13?.amount_due === 5400, c13)
}

main(process.argv.slice(2)).catch(async (e) => {
  console.error(redact(`regression failed: ${e?.type ?? ''} ${e?.code ?? ''} ${String(e?.message ?? e).slice(0, 300)}`))
  if (client && !keep) for (const id of clocks) await client.testHelpers.testClocks.del(id).catch(() => undefined)
  if (clocks.length) console.error(keep ? `kept clocks ${clocks.join(', ')}` : `deleted ${clocks.length} test clocks`)
  process.exit(1)
})
