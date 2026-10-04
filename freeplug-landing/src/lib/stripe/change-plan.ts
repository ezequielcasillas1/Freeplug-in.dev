import type Stripe from 'stripe'
// Relative import on purpose: scripts/stripe-test-setup-ladder.mjs loads this file (jiti) for the
// test-mode probes, outside Next's "@/" alias.
import { addonById, isPlanStepId, stepById, stepByLookupKey, TIP_TOTAL_RANGES, type AddonId, type PlanStep, type PlanStepId } from '../plans/ladder'
import { PRORATION_DATE_MAX_AGE_SECONDS, planMove, type PlanMove } from '../plans/plan-direction'
import { subscriptionPeriodEnd } from './subscription-dates'
import { parseTipDollars, tierItems, tipItemOf, tipDollarsOfItems, tipRangeFor } from '../plans/tips'
import { addonCapCheck, addonCentsInTipTotal, addonCentsOfItems, addonIdsOfItems, addonItemsOf, addonOfPrice, parseAddonIds } from '../plans/addons'
import { ADDON_PENDING_REMOVAL, ADDON_PENDING_SWITCH, ADDON_TURN_OFF_FIRST } from '../plans/ladder-copy'

export { planMove, type PlanMove }

/**
 * Moving a live hosting subscription to a ladder step (Aria section 6.4). Done in the app, not the
 * Billing Portal: Stripe's portal can only schedule a period-end downgrade between prices of the
 * same product, and a product can't hold two monthly prices in a portal configuration (checked in
 * test mode, Oct 3), so the portal can't give a monthly ladder "downgrades at period end". The
 * ladder portal configuration keeps plan switching OFF.
 *
 *   upgrade   (step price > what the subscription costs now): immediate. Items are replaced by
 *             the step price with proration_behavior=always_invoice (the time-based difference is
 *             invoiced and charged right away) and payment_behavior=pending_if_incomplete: if the
 *             card fails, Stripe does NOT apply the change (subscription.pending_update holds it);
 *             we then void that invoice so nothing can apply it later, and the old plan stays.
 *             A pending downgrade is released FIRST (and put back if the card fails).
 *   downgrade (step price < now): at period end, through a subscription schedule (phase 1 = the
 *             LIVE subscription items until current_period_end, phase 2 = the step price). Nobody
 *             gets a mid-month credit; perks stay until the period ends. The schedule is released as
 *             soon as phase 2 is current (webhook + lazily on the next read; see "Schedule lifecycle").
 *   same step: nothing changes (a pending downgrade is cancelled).
 *
 * Nothing here writes entitlements. profiles.plan_step and the perks change only when the Stripe
 * webhook (customer.subscription.created/updated/deleted) re-syncs from Stripe's actual subscription
 * (src/lib/plans/plan-step-sync.ts); creating a schedule leaves the subscription's items unchanged.
 *
 * sellable=false steps (ladder.ts) can't be moved TO; a customer already on one keeps it, and
 * picking it again ("keep my plan") still cancels a pending downgrade.
 *
 * Cancel vs downgrade: Stripe refuses cancel_at_period_end on a subscription managed by a schedule
 * ("updating any cancelation behavior directly is not allowed", test mode Oct 3), so
 * cancelPlanAtPeriodEnd() releases the pending downgrade first; a plan that is already set to end
 * can't be switched (resume it first).
 *
 * Grandfathered plans move only when the customer picks a step (never automatically). Their
 * "now" amount is the subscription's monthly total (hosting + add-on); an equal-priced step is
 * treated as an upgrade (applied now, zero proration).
 *
 * The tipping system (Oct 3): a tip item (src/lib/plans/tips.ts) never counts as the plan. The step
 * and the "now" amount come from the tier item(s) only, and ANY step change resets the tip to $0:
 * an upgrade deletes the tip item in the same update (the preview includes that), and a downgrade's
 * next schedule phase holds only the new step price, so the tip item stops at the switch date. A tip
 * change (changeTip) applies from the next billing date with proration_behavior=none and is refused
 * while a switch is planned (the tip would end at the switch anyway).
 *
 * Add-ons (Oct 4, src/lib/plans/addons.ts): their own items, never the plan. Every call site splits
 * step / add-ons / tip:
 *   - an upgrade keeps the add-on items (only the step price changes; the tip and any other item go);
 *   - a downgrade's next phase = the new step price + the add-ons still on (no tip);
 *   - turning one ON is immediate (always_invoice, charged now, like an upgrade);
 *   - turning one OFF is at period end, through the same schedule: its next phase = the live step +
 *     the add-ons left + the live tip (phase metadata kind=addons). It counts as a pending change
 *     (tip changes and turning add-ons ON wait; "Keep it" undoes it).
 *   - while a STEP switch is planned every add-on change is refused (ADDON_PENDING_SWITCH); a plan
 *     switch made while an add-on removal is pending keeps the removal (downgrade: in its next phase;
 *     upgrade: re-scheduled after the charge; keep my plan: the removal stays).
 *   - Starter cap (ADDON_STEP_LIMITS): add-ons <= $15 and plan + add-ons + tip <= the $54 range max,
 *     checked here from the live Stripe amounts.
 */

/** A schedule's next phase, read back (metadata first, else by resolving the phase's prices). */
export type ScheduledPhase = {
  step: PlanStepId
  effectiveAt: string
  scheduleId: string
  /** Add-ons in the next phase (ADDONS order). */
  addons: AddonId[]
  /** Tip (whole dollars) in the next phase; 0 for a step switch. */
  tipDollars: number
}

/** A pending change as shown to the customer: a step switch, add-ons that end, or both. */
export type PendingPlanChange = ScheduledPhase & {
  /** The next phase's step differs from the live step ("Changing to X on <date>"). */
  isSwitch: boolean
  /** Live add-ons that the next phase drops ("<add-on> ends <date>"). */
  removedAddons: AddonId[]
}

export type ChangePlanResult =
  | {
      ok: true
      kind: 'upgraded'
      step: PlanStepId
      invoiceStatus: string | null
      /** A pending add-on removal was re-scheduled on the new step (null = none was pending). */
      addonRemovalKept?: boolean | null
    }
  | { ok: true; kind: 'scheduled'; step: PlanStepId; effectiveAt: string }
  | { ok: true; kind: 'unchanged'; step: PlanStepId }
  | { ok: false; code: 'payment_failed'; message: string; pendingRestored: boolean | null }
  | { ok: false; code: 'not_live' | 'ending' | 'price' | 'not_sellable' | 'stale_preview' | 'in_progress' | 'addons_over_cap'; message: string }

/**
 * Upgrade confirm (Aria, Oct 3 1:34 PM): the amount shown is a read-only Stripe preview
 * (invoices.createPreview) at a server-generated proration_date, and Confirm sends that same
 * proration_date back so the charge equals the preview. It is refused when it is more than
 * PRORATION_DATE_MAX_AGE_SECONDS old (the customer looks again) or in the future.
 */
export { PRORATION_DATE_MAX_AGE_SECONDS }

export type ProrationDateCheck = 'ok' | 'stale' | 'future' | 'invalid'

export function checkProrationDate(value: unknown, now: Date): ProrationDateCheck {
  if (typeof value !== 'number' || !Number.isSafeInteger(value) || value <= 0) return 'invalid'
  const nowSec = Math.floor(now.getTime() / 1000)
  if (value > nowSec) return 'future'
  if (nowSec - value > PRORATION_DATE_MAX_AGE_SECONDS) return 'stale'
  return 'ok'
}

export type PlanChangePreview =
  | {
      ok: true
      step: PlanStepId
      prorationDate: number
      /** What the always_invoice proration invoice would charge now (after any customer credit). */
      amountDueCents: number
      currency: string
      /** The step's monthly price, billed from nextBillingAt (the billing date does not move). */
      nextAmountCents: number
      nextBillingAt: string | null
      /** The tip that this upgrade ends (whole dollars; 0 = none). Its unused part is in amountDueCents. */
      tipDollars: number
      /** Add-ons that stay on through the upgrade ("Your add-ons stay on: …"); in nextAmountCents. */
      addons: AddonId[]
      addonCents: number
    }
  | { ok: false; code: 'not_live' | 'ending' | 'not_upgrade' | 'not_sellable' | 'price' | 'addons_over_cap'; message: string }

type Sub = Pick<Stripe.Subscription, 'id' | 'status' | 'cancel_at_period_end' | 'cancel_at' | 'schedule' | 'items'> & {
  latest_invoice?: string | { id: string } | null
}

/** What the PLAN costs a month (tier items only; a tip or an add-on never counts). */
export function subscriptionMonthlyCents(sub: Pick<Stripe.Subscription, 'items'>): number {
  return tierItems(sub.items.data).reduce((sum, item) => {
    const amount = (item.price.unit_amount ?? 0) * (item.quantity ?? 1)
    return sum + (item.price.recurring?.interval === 'year' ? Math.round(amount / 12) : amount)
  }, 0)
}

/** The ladder step a subscription is on (by price lookup key), or null for a grandfathered plan. */
export function currentLadderStep(sub: Pick<Stripe.Subscription, 'items'>): PlanStep | null {
  const tier = tierItems(sub.items.data)
  if (tier.length !== 1) return null
  return stepByLookupKey(tier[0].price.lookup_key)
}

/** The customer's monthly tip in whole dollars (0 = no tip item). */
export function subscriptionTipDollars(sub: Pick<Stripe.Subscription, 'items'>): number {
  return tipDollarsOfItems(sub.items.data)
}

/** The subscription's add-ons and what they cost a month (live Stripe amounts). */
export function subscriptionAddons(sub: Pick<Stripe.Subscription, 'items'>): { ids: AddonId[]; cents: number } {
  return { ids: addonIdsOfItems(sub.items.data), cents: addonCentsOfItems(sub.items.data) }
}

const sameSet = (a: readonly string[], b: readonly string[]) => a.length === b.length && a.every((x) => b.includes(x))

/**
 * Server cap check for a step with these add-on items and no tip (a plan change resets the tip):
 * the step's add-on cap and plan + add-ons <= the step's range max (ladder.ts). Today's two add-ons
 * ($10.75) always fit Starter; a failure is refused with "Turn off an add-on first", never by
 * ending an add-on automatically.
 */
export function addonsFitStep(stepId: PlanStepId, addonItems: readonly Pick<Stripe.SubscriptionItem, 'price' | 'quantity'>[]): boolean {
  const list = addonItems.map((i) => ({ id: addonOfPrice(i.price)!.id, cents: (i.price.unit_amount ?? 0) * Math.max(1, i.quantity ?? 1) }))
  if (!addonCapCheck(stepId, list).ok) return false
  const step = stepById(stepId)
  const counted = addonCentsInTipTotal(stepId, list.reduce((n, a) => n + a.cents, 0))
  return step.monthlyCents + counted <= Math.max(step.monthlyCents, TIP_TOTAL_RANGES[stepId].maxDollars * 100)
}

const idOf = (v: string | { id: string } | null | undefined) => (typeof v === 'string' ? v : (v?.id ?? null))
const scheduleId = (sub: Pick<Stripe.Subscription, 'schedule'>) => idOf(sub.schedule as string | { id: string } | null)

type ScheduleLike = Pick<Stripe.SubscriptionSchedule, 'id' | 'status' | 'phases'> & {
  current_phase?: { start_date: number; end_date: number } | null
  test_clock?: string | { id: string } | null
}

const isOpenSchedule = (s: Pick<Stripe.SubscriptionSchedule, 'status'>) => !s.status || s.status === 'active' || s.status === 'not_started'

/**
 * Schedule lifecycle (Aria, Oct 3 3:43 PM; Vera round 5 bugs 2 and 3). A plan switch is "pending"
 * ONLY while one of the schedule's phases starts in the future. Once the switch phase is current the
 * schedule has done its job: it is released (from the webhook, subscription_schedule.updated or
 * invoice.paid, and lazily on the next read), so tip changes, Manage billing and the next switch
 * work right after the switch date instead of a month later.
 */
export function scheduleHasFutureSwitch(
  schedule: Pick<Stripe.SubscriptionSchedule, 'status' | 'phases'> & Pick<ScheduleLike, 'current_phase'>,
  now: Date
): boolean {
  if (!isOpenSchedule(schedule)) return false
  const nowSec = Math.floor(now.getTime() / 1000)
  const phases = schedule.phases ?? []
  // A phase still starts after "now" on the subscription's clock: the switch is ahead.
  if (phases.some((p) => p.start_date > nowSec)) return true
  // Vera / Aria (Oct 3, next round): decide on Stripe's current_phase. The clock has passed every
  // phase start, but until Stripe has moved current_phase to the switch (last) phase, the switch
  // hasn't happened yet: keep it.
  const last = phases[phases.length - 1]
  const current = schedule.current_phase
  return !!current && !!last && current.start_date < last.start_date
}

/**
 * "Now" on the subscription's clock: a test clock's frozen_time when the schedule (or subscription)
 * runs on one, else `wallNow`. Production objects have no test clock, so production costs no extra
 * call. Test clocks then behave like production (Vera, 68d7e2b report: a clock ahead of or behind wall
 * time made the wall-clock comparison release too late or too early).
 */
export async function subscriptionClockNow(
  stripe: Stripe,
  holder: { test_clock?: string | { id: string; frozen_time?: number } | null },
  wallNow: Date = new Date()
): Promise<Date> {
  const clock = holder.test_clock
  if (!clock) return wallNow
  if (typeof clock === 'object' && typeof clock.frozen_time === 'number') return new Date(clock.frozen_time * 1000)
  const id = typeof clock === 'string' ? clock : clock.id
  const c = await stripe.testHelpers.testClocks.retrieve(id)
  return new Date(c.frozen_time * 1000)
}

/** Release a schedule; one that is already released, canceled or completed counts as done. */
async function releaseSchedule(stripe: Stripe, id: string): Promise<void> {
  try {
    await stripe.subscriptionSchedules.release(id)
  } catch (e) {
    const again = await stripe.subscriptionSchedules.retrieve(id).catch(() => null)
    if (again && !isOpenSchedule(again)) return
    throw e
  }
}

export type ScheduleSettleOutcome = 'pending' | 'released' | 'closed'

/**
 * For the webhook (and the lazy read path): release the schedule when no phase starts in the future
 * on the subscription's clock (a test clock's frozen_time, else `now`) and Stripe's current_phase is
 * the switch phase. 'pending' = a switch is still ahead (left alone); 'closed' = already
 * released/canceled/completed.
 */
export async function releaseScheduleIfSwitched(
  stripe: Stripe,
  schedule: string | ScheduleLike,
  now: Date = new Date()
): Promise<ScheduleSettleOutcome> {
  const s = (typeof schedule === 'string' ? await stripe.subscriptionSchedules.retrieve(schedule) : schedule) as ScheduleLike
  if (!isOpenSchedule(s)) return 'closed'
  if (scheduleHasFutureSwitch(s, await subscriptionClockNow(stripe, s, now))) return 'pending'
  await releaseSchedule(stripe, s.id)
  return 'released'
}

/**
 * The subscription's schedule if a switch is still ahead, else null. A schedule whose switch phase is
 * already current is released here (lazily, Aria 3:43 PM); a released one is ignored.
 */
async function liveSchedule(stripe: Stripe, sub: Pick<Stripe.Subscription, 'schedule'>, now: Date): Promise<ScheduleLike | null> {
  const id = scheduleId(sub)
  if (!id) return null
  const schedule = (await stripe.subscriptionSchedules.retrieve(id)) as ScheduleLike
  return (await releaseScheduleIfSwitched(stripe, schedule, now)) === 'pending' ? schedule : null
}

/** True while the subscription has a switch ahead (releases a finished schedule on the way). */
export async function hasPendingSwitch(stripe: Stripe, sub: Pick<Stripe.Subscription, 'schedule'>, now: Date = new Date()): Promise<boolean> {
  return (await liveSchedule(stripe, sub, now)) !== null
}

async function pendingFromSchedule(stripe: Stripe, schedule: ScheduleLike, now: Date): Promise<ScheduledPhase | null> {
  const nowSec = Math.floor((await subscriptionClockNow(stripe, schedule, now)).getTime() / 1000)
  // The next phase on the subscription's clock; with the clock past it but Stripe's current_phase
  // not moved yet, that last phase is still the one ahead.
  const last = schedule.phases[schedule.phases.length - 1]
  const next =
    schedule.phases.find((p) => p.start_date > nowSec) ??
    (schedule.current_phase && last && schedule.current_phase.start_date < last.start_date ? last : undefined)
  if (!next || next.items.length === 0) return null
  const effectiveAt = new Date(next.start_date * 1000).toISOString()
  const meta = (next.metadata ?? {}) as Record<string, string | undefined>
  // Our own phases carry plan_step + addons + tip_dollars (Oct 4); pre-add-on phases carry plan_step
  // only and hold exactly one item (the step price).
  if (isPlanStepId(meta.plan_step) && typeof meta.addons === 'string') {
    const addons = parseAddonIds(meta.addons ? meta.addons.split(',') : [])
    const tip = Number.parseInt(meta.tip_dollars ?? '0', 10)
    if (addons) return { step: meta.plan_step, effectiveAt, scheduleId: schedule.id, addons, tipDollars: Number.isSafeInteger(tip) && tip > 0 ? tip : 0 }
  }
  if (isPlanStepId(meta.plan_step) && next.items.length === 1) {
    return { step: meta.plan_step, effectiveAt, scheduleId: schedule.id, addons: [], tipDollars: 0 }
  }
  // Anything else (several items, no metadata): resolve every price and split step / add-ons / tip.
  const items = await Promise.all(
    next.items.map(async (i) => ({
      price: typeof i.price === 'string' ? await stripe.prices.retrieve(i.price) : (i.price as Stripe.Price),
      quantity: i.quantity ?? 1,
    }))
  )
  const tier = tierItems(items)
  if (tier.length !== 1) return null
  const stepId = (isPlanStepId(meta.plan_step) ? meta.plan_step : null) ?? stepByLookupKey(tier[0].price.lookup_key)?.id ?? null
  if (!stepId) return null
  return { step: stepId, effectiveAt, scheduleId: schedule.id, addons: addonIdsOfItems(items), tipDollars: tipDollarsOfItems(items) }
}

/** How a scheduled phase reads against the live subscription. */
export function describePending(phase: ScheduledPhase, sub: Pick<Stripe.Subscription, 'items'>): PendingPlanChange {
  const live = addonIdsOfItems(sub.items.data)
  return { ...phase, isSwitch: phase.step !== currentLadderStep(sub)?.id, removedAddons: live.filter((a) => !phase.addons.includes(a)) }
}

/**
 * The change waiting in the subscription's schedule (a step switch and/or add-ons that end), or
 * null. Used by the Plans page ("Changing to X on <date>", "<add-on> ends <date>"), the dashboard and
 * the cancel page; a schedule whose switch already happened is released here (the lazy half).
 * A phase that changes neither the step nor the add-ons reads as null.
 */
export async function pendingPlanChange(
  stripe: Stripe,
  sub: Pick<Stripe.Subscription, 'schedule' | 'items'>,
  now: Date = new Date()
): Promise<PendingPlanChange | null> {
  const schedule = await liveSchedule(stripe, sub, now)
  const phase = schedule ? await pendingFromSchedule(stripe, schedule, now) : null
  if (!phase) return null
  const pending = describePending(phase, sub)
  return pending.isSwitch || pending.removedAddons.length > 0 ? pending : null
}

/** The live subscription's items as schedule phase items (Aria: never copied from a schedule phase). */
export function liveScheduleItems(sub: Pick<Stripe.Subscription, 'items'>): Stripe.SubscriptionScheduleUpdateParams.Phase.Item[] {
  return sub.items.data.map((i) => ({ price: i.price.id, quantity: i.quantity ?? 1 }))
}

type PhaseItem = Stripe.SubscriptionScheduleUpdateParams.Phase.Item

/**
 * Next-phase items: the step price + the given add-ons + a tip, reusing the LIVE subscription's
 * add-on and tip prices (an add-on or tip that isn't on the subscription can't be scheduled; throws).
 */
export function nextPhaseItems(sub: Pick<Stripe.Subscription, 'id' | 'items'>, stepPriceId: string, addons: readonly AddonId[], tipDollars: number): PhaseItem[] {
  const items: PhaseItem[] = [{ price: stepPriceId, quantity: 1 }]
  for (const id of addons) {
    const live = addonItemsOf(sub.items.data).find((i) => addonOfPrice(i.price)?.id === id)
    if (!live) throw new Error(`add-on ${id} is not on ${sub.id}`)
    items.push({ price: live.price.id, quantity: 1 })
  }
  if (tipDollars > 0) {
    const tip = tipItemOf(sub.items.data)
    if (!tip) throw new Error(`no tip item on ${sub.id}`)
    items.push({ price: tip.price.id, quantity: tipDollars })
  }
  return items
}

/** Phase metadata read back by pendingFromSchedule (and copied to the subscription when the phase starts). */
export function phaseMetadata(step: PlanStepId, addons: readonly AddonId[], tipDollars: number, kind: 'switch' | 'addons'): Record<string, string> {
  return { plan_step: step, addons: addons.join(','), tip_dollars: String(Math.max(0, tipDollars)), kind }
}

/**
 * Change at period end. Phase 1 = the LIVE subscription items until the current period ends,
 * phase 2 = `items` (released once current). With a schedule already attached (a change ahead) only
 * its future phase changes: the current phase keeps its start date and gets the live items, and ended
 * phases are dropped. proration_behavior none everywhere: a schedule edit never charges or credits.
 * Used for step downgrades (kind switch) and add-on removals (kind addons).
 */
async function scheduleNextPhase(
  stripe: Stripe,
  sub: Pick<Stripe.Subscription, 'id' | 'items'>,
  existing: ScheduleLike | null,
  items: PhaseItem[],
  metadata: Record<string, string>,
  now: Date
): Promise<string> {
  const schedule = (existing ?? (await stripe.subscriptionSchedules.create({ from_subscription: sub.id }))) as ScheduleLike
  const nowSec = Math.floor((schedule.current_phase ? now : await subscriptionClockNow(stripe, schedule, now)).getTime() / 1000)
  const current =
    schedule.current_phase ?? schedule.phases.find((p) => p.start_date <= nowSec && p.end_date > nowSec) ?? schedule.phases[0]
  const periodEnd = subscriptionPeriodEnd(sub as Stripe.Subscription)
  const end = periodEnd ? Math.floor(periodEnd.getTime() / 1000) : current.end_date
  await stripe.subscriptionSchedules.update(schedule.id, {
    end_behavior: 'release',
    proration_behavior: 'none',
    phases: [
      { items: liveScheduleItems(sub), start_date: current.start_date, end_date: end, proration_behavior: 'none' },
      { items, proration_behavior: 'none', duration: { interval: 'month', interval_count: 1 }, metadata },
    ],
  })
  return new Date(end * 1000).toISOString()
}

/** The live step item's price id (ladder subscriptions only). */
const liveStepPriceId = (sub: Pick<Stripe.Subscription, 'items'>) => tierItems(sub.items.data)[0]?.price.id ?? null

const isCardError = (e: unknown) =>
  !!e && typeof e === 'object' && ((e as { type?: string }).type === 'StripeCardError' || (e as { code?: string }).code === 'card_declined')

const PAYMENT_FAILED = 'The card was not charged, so the plan did not change.'

/** Stripe's 409 for a second request with the same idempotency key while the first is in flight. */
const isKeyInUse = (e: unknown) => !!e && typeof e === 'object' && (e as { code?: string }).code === 'idempotency_key_in_use'

/**
 * Items for an upgrade: the TIER item (the ladder price, else a legacy plan's first plan item)
 * becomes the step price; the Oct 4 add-on items STAY (untouched); every other item goes: a
 * grandfathered add-on AND the tip (a plan change resets the tip to $0). Exported for tests.
 */
export function upgradeItems(sub: Pick<Stripe.Subscription, 'items'>, priceId: string): Stripe.SubscriptionUpdateParams.Item[] {
  const tier = tierItems(sub.items.data)
  const keep = tier.find((i) => stepByLookupKey(i.price.lookup_key)) ?? tier[0] ?? sub.items.data[0]
  const addonIds = new Set(addonItemsOf(sub.items.data).map((i) => i.id))
  const rest = sub.items.data.filter((i) => i.id !== keep.id && !addonIds.has(i.id))
  return [{ id: keep.id, price: priceId, quantity: 1 }, ...rest.map((i) => ({ id: i.id, deleted: true as const }))]
}

export function upgradeIdempotencyKey(
  sub: Pick<Sub, 'id' | 'items' | 'latest_invoice'>,
  target: PlanStepId,
  opts: { prorationDate?: number; userId?: string } = {}
): string {
  const prices = sub.items.data.map((i) => i.price.id).join('+')
  return `plan-move:${opts.userId ?? 'na'}:${target}:${opts.prorationDate ?? 'now'}:${sub.id}:${prices}:${idOf(sub.latest_invoice) ?? 'none'}`
}

/**
 * Read-only preview of an upgrade (nothing is charged or changed): the proration invoice Stripe
 * would create right now with always_invoice at `prorationDate`. Downgrades and "same" get
 * not_upgrade (no confirm for them). Stripe errors are thrown; the caller falls back to "We'll
 * charge the difference today" and still sends the proration_date with Confirm.
 */
export async function previewPlanStepChange(
  deps: { stripe: Stripe; priceIdFor: (id: PlanStepId) => Promise<string> },
  sub: Sub,
  targetId: PlanStepId,
  prorationDate: number
): Promise<PlanChangePreview> {
  const target = stepById(targetId)
  if (sub.status !== 'active' && sub.status !== 'trialing') return { ok: false, code: 'not_live', message: 'No active hosting plan to change.' }
  if (sub.cancel_at_period_end || sub.cancel_at) return { ok: false, code: 'ending', message: 'This plan is set to end. Resume it first.' }
  if (planMove(currentLadderStep(sub), subscriptionMonthlyCents(sub), target) !== 'upgrade') {
    return { ok: false, code: 'not_upgrade', message: 'Only an upgrade is charged now.' }
  }
  if (!target.sellable) return { ok: false, code: 'not_sellable', message: `${target.name} is not sold yet.` }
  if (!addonsFitStep(target.id, addonItemsOf(sub.items.data))) return { ok: false, code: 'addons_over_cap', message: ADDON_TURN_OFF_FIRST }
  let priceId: string
  try {
    priceId = await deps.priceIdFor(target.id)
  } catch {
    return { ok: false, code: 'price', message: 'This plan is not available right now.' }
  }
  const addons = subscriptionAddons(sub)
  const preview = await deps.stripe.invoices.createPreview({
    subscription: sub.id,
    subscription_details: { items: upgradeItems(sub, priceId), proration_behavior: 'always_invoice', proration_date: prorationDate },
  })
  const end = subscriptionPeriodEnd(sub as Stripe.Subscription)
  return {
    ok: true,
    step: target.id,
    prorationDate,
    amountDueCents: preview.amount_due,
    currency: preview.currency,
    nextAmountCents: target.monthlyCents + addons.cents,
    nextBillingAt: end ? end.toISOString() : null,
    tipDollars: subscriptionTipDollars(sub),
    addons: addons.ids,
    addonCents: addons.cents,
  }
}

export async function changePlanStep(
  deps: { stripe: Stripe; priceIdFor: (id: PlanStepId) => Promise<string>; now?: () => Date; log?: (msg: string) => void },
  sub: Sub,
  targetId: PlanStepId,
  /** prorationDate: from previewPlanStepChange (upgrades only); userId: for the idempotency key. */
  opts: { prorationDate?: number; userId?: string } = {}
): Promise<ChangePlanResult> {
  const { stripe } = deps
  const log = deps.log ?? ((m: string) => console.error(m))
  const target = stepById(targetId)
  if (sub.status !== 'active' && sub.status !== 'trialing') {
    return { ok: false, code: 'not_live', message: 'No active hosting plan to change.' }
  }
  if (sub.cancel_at_period_end || sub.cancel_at) {
    return { ok: false, code: 'ending', message: 'This plan is set to end. Resume it first.' }
  }
  const current = currentLadderStep(sub)
  const move = planMove(current, subscriptionMonthlyCents(sub), target)
  const now = deps.now?.() ?? new Date()
  // Only a schedule with a switch ahead counts; one whose switch already happened is released here.
  const settle = async () => (scheduleId(sub) ? liveSchedule(stripe, sub, now) : null)

  if (move === 'same') {
    // "Keep my plan": the step switch goes; an add-on removal planned with it stays (the next phase
    // becomes the live step + the add-ons left + the live tip). Nothing else pending: release.
    const schedule = await settle()
    if (schedule) {
      const phase = await pendingFromSchedule(stripe, schedule, now).catch(() => null)
      const liveAddons = addonIdsOfItems(sub.items.data)
      const stepPrice = liveStepPriceId(sub)
      if (current && stepPrice && phase && !sameSet(phase.addons, liveAddons)) {
        const left = liveAddons.filter((a) => phase.addons.includes(a))
        const tip = subscriptionTipDollars(sub)
        await scheduleNextPhase(stripe, sub, schedule, nextPhaseItems(sub, stepPrice, left, tip), phaseMetadata(current.id, left, tip, 'addons'), now)
      } else {
        await releaseSchedule(stripe, schedule.id)
      }
    }
    return { ok: true, kind: 'unchanged', step: target.id }
  }
  if (!target.sellable) {
    return { ok: false, code: 'not_sellable', message: `${target.name} is not sold yet.` }
  }

  // Add-ons stay on through any switch and the tip resets to 0, so the target step must fit the
  // add-ons still on (Starter: <= $15 and $35 + add-ons <= $54). Never true today ($10.75); refused,
  // never auto-ended, if prices ever change.
  if (!addonsFitStep(target.id, addonItemsOf(sub.items.data))) {
    return { ok: false, code: 'addons_over_cap', message: ADDON_TURN_OFF_FIRST }
  }

  let priceId: string
  try {
    priceId = await deps.priceIdFor(target.id)
  } catch {
    return { ok: false, code: 'price', message: 'This plan is not available right now.' }
  }

  if (move === 'upgrade') {
    // The confirmed amount's proration_date: checked before anything changes in Stripe.
    if (opts.prorationDate !== undefined) {
      const check = checkProrationDate(opts.prorationDate, deps.now?.() ?? new Date())
      if (check !== 'ok') return { ok: false, code: 'stale_preview', message: `The previewed amount can't be used (${check}). Check it again.` }
    }
    const schedule = await settle()
    // Release a pending change first (Aria, Oct 3 12:25). Remember it so a failed card puts it back.
    let restore: ScheduledPhase | null = null
    if (schedule) {
      restore = await pendingFromSchedule(stripe, schedule, now).catch(() => null)
      await releaseSchedule(stripe, schedule.id)
    }
    const putBack = async (): Promise<boolean | null> => {
      if (!restore) return null
      try {
        const isSwitch = restore.step !== current?.id
        const stepPrice = isSwitch ? await deps.priceIdFor(restore.step) : liveStepPriceId(sub)
        if (!stepPrice) throw new Error('no step price')
        const tip = isSwitch ? 0 : restore.tipDollars
        await scheduleNextPhase(
          stripe,
          sub,
          null,
          nextPhaseItems(sub, stepPrice, restore.addons, tip),
          phaseMetadata(restore.step, restore.addons, tip, isSwitch ? 'switch' : 'addons'),
          now
        )
        return true
      } catch (e) {
        log(`[change-plan] could not restore the pending change on ${sub.id}: ${e instanceof Error ? e.message : String(e)}`)
        return false
      }
    }
    let updated: Stripe.Subscription
    try {
      updated = await stripe.subscriptions.update(
        sub.id,
        {
          items: upgradeItems(sub, priceId),
          proration_behavior: 'always_invoice',
          payment_behavior: 'pending_if_incomplete',
          ...(opts.prorationDate !== undefined ? { proration_date: opts.prorationDate } : {}),
          expand: ['latest_invoice'],
        },
        // user + step + proration_date (Aria 1:34 PM): a double Confirm sends the same key, so Stripe
        // runs the update once. The subscription's prices and latest invoice id keep a retry after a
        // failed card a NEW request (a reused key would replay the failed response for 24 hours).
        { idempotencyKey: upgradeIdempotencyKey(sub, target.id, opts) }
      )
    } catch (e) {
      // A double Confirm (same user + step + proration_date) while the first is still running: the
      // first one charges; this one changes nothing and must not put a pending downgrade back.
      if (isKeyInUse(e)) return { ok: false, code: 'in_progress', message: 'This plan change is already going through.' }
      if (!isCardError(e)) throw e
      return { ok: false, code: 'payment_failed', message: PAYMENT_FAILED, pendingRestored: await putBack() }
    }
    if (updated.pending_update) {
      // Not applied. Void the open invoice so a later retry or card update can't apply it.
      const inv = updated.latest_invoice
      const invId = idOf(inv as string | { id: string } | null)
      const invStatus = inv && typeof inv !== 'string' ? inv.status : null
      if (invId && (invStatus === 'open' || invStatus === null)) {
        await stripe.invoices.voidInvoice(invId).catch((e) => log(`[change-plan] could not void ${invId}: ${e instanceof Error ? e.message : String(e)}`))
      }
      return { ok: false, code: 'payment_failed', message: PAYMENT_FAILED, pendingRestored: await putBack() }
    }
    const inv = updated.latest_invoice
    // An add-on removal that was pending stays pending on the new step (its next phase = the new step
    // + the add-ons left, no tip: the upgrade just reset it). A failure here is logged and reported;
    // the upgrade itself already went through.
    let addonRemovalKept: boolean | null = null
    const liveAddons = addonIdsOfItems(sub.items.data)
    if (restore && !sameSet(restore.addons, liveAddons) && updated.items?.data) {
      const left = liveAddons.filter((a) => restore.addons.includes(a))
      try {
        await scheduleNextPhase(stripe, updated, null, nextPhaseItems(updated, priceId, left, 0), phaseMetadata(target.id, left, 0, 'addons'), now)
        addonRemovalKept = true
      } catch (e) {
        log(`[change-plan] could not re-schedule the add-on removal on ${sub.id}: ${e instanceof Error ? e.message : String(e)}`)
        addonRemovalKept = false
      }
    }
    return {
      ok: true,
      kind: 'upgraded',
      step: target.id,
      invoiceStatus: inv && typeof inv !== 'string' ? (inv.status ?? null) : null,
      ...(addonRemovalKept !== null ? { addonRemovalKept } : {}),
    }
  }

  // Downgrade at period end: the next phase = the new step + the add-ons still on (an add-on removal
  // already pending is kept), no tip.
  const schedule = await settle()
  const phase = schedule ? await pendingFromSchedule(stripe, schedule, now).catch(() => null) : null
  const liveAddons = addonIdsOfItems(sub.items.data)
  const keep = phase ? liveAddons.filter((a) => phase.addons.includes(a)) : liveAddons
  const effectiveAt = await scheduleNextPhase(stripe, sub, schedule, nextPhaseItems(sub, priceId, keep, 0), phaseMetadata(target.id, keep, 0, 'switch'), now)
  return { ok: true, kind: 'scheduled', step: target.id, effectiveAt }
}

export type CancelPlanResult =
  | { ok: true; kind: 'canceled' | 'already_ending'; clearedPendingChange: PendingPlanChange | null }
  | { ok: false; code: 'not_live'; message: string }

/**
 * Cancel at period end, clearing a pending downgrade first (Stripe refuses cancel_at_period_end
 * while a schedule manages the subscription). Already ending: nothing to do.
 */
export async function cancelPlanAtPeriodEnd(stripe: Stripe, sub: Sub, now: Date = new Date()): Promise<CancelPlanResult> {
  if (sub.status !== 'active' && sub.status !== 'trialing') {
    return { ok: false, code: 'not_live', message: 'No active hosting plan to cancel.' }
  }
  if (sub.cancel_at_period_end || sub.cancel_at) return { ok: true, kind: 'already_ending', clearedPendingChange: null }
  // Stripe refuses cancel_at_period_end while ANY schedule is attached: a switch ahead is cleared
  // (and reported), a finished one is released by liveSchedule().
  let cleared: PendingPlanChange | null = null
  let released: string | null = null
  if (scheduleId(sub)) {
    const schedule = await liveSchedule(stripe, sub, now)
    if (schedule) {
      const phase = await pendingFromSchedule(stripe, schedule, now).catch(() => null)
      cleared = phase ? describePending(phase, sub) : null
      await releaseSchedule(stripe, schedule.id)
    }
    released = scheduleId(sub)
  }
  // One key per cancel (the caller holds the change-plan lock): a fixed key would replay the first
  // cancel's response for 24 h after a resume, so a second cancel would silently do nothing.
  await stripe.subscriptions.update(
    sub.id,
    { cancel_at_period_end: true },
    { idempotencyKey: `plan-cancel:${sub.id}:${released ?? 'none'}:${crypto.randomUUID()}` }
  )
  return { ok: true, kind: 'canceled', clearedPendingChange: cleared }
}

// ------------------------------------------------------------------ the tipping system: tip changes

export type TipChangeRefusal = 'not_live' | 'ending' | 'pending_change' | 'no_tip_plan' | 'out_of_range' | 'price'
/** Stripe answered, but its subscription doesn't hold the requested tip (Vera B2: a replayed response). */
export type TipChangeFailure = 'mismatch'

export type TipChangePreview =
  | {
      ok: true
      step: PlanStepId
      tipDollars: number
      /** The next regular invoice after the change (step price + new tip, after any customer credit). */
      nextAmountCents: number
      currency: string
      nextBillingAt: string | null
      unchanged: boolean
    }
  | { ok: false; code: TipChangeRefusal; message: string }

export type TipChangeResult =
  | { ok: true; kind: 'changed' | 'unchanged'; step: PlanStepId; tipDollars: number; nextAmountCents: number; nextBillingAt: string | null }
  | { ok: false; code: TipChangeRefusal | TipChangeFailure; message: string }

/** A per-Confirm id from the tip preview (or the client); anything else gets a fresh random id. */
export function isTipConfirmId(v: unknown): v is string {
  return typeof v === 'string' && /^[A-Za-z0-9_-]{8,64}$/.test(v)
}

/**
 * Idempotency key for one tip Confirm (Vera B2, Oct 3). Keyed by the Confirm, not by amounts and time:
 * the old "<from>:<to>:<minute>" key made $9 -> $4 -> $9 -> $4 inside a minute replay the first response
 * without applying anything. The same Confirm retried (double tap, network retry) reuses its id and
 * dedupes; a new Confirm always gets a new id. Without a valid id, a random one (no dedupe; the
 * change-plan lock still refuses a concurrent second Confirm).
 */
export function tipChangeIdempotencyKey(userId: string | undefined, subId: string, confirmId: unknown, next: number): string {
  const id = isTipConfirmId(confirmId) ? confirmId : `r-${crypto.randomUUID()}`
  return `tip-change:${userId ?? 'na'}:${subId}:${id}:${next}`
}

type TipCheck =
  | { ok: true; step: PlanStep; current: number; items: Stripe.SubscriptionUpdateParams.Item[] }
  | { ok: false; code: TipChangeRefusal; message: string }

/** Shared checks + the item change for a new tip (no Stripe call except the tip price lookup). */
async function tipChangeItems(
  stripe: Stripe,
  sub: Sub,
  tipDollars: unknown,
  tipPriceId: () => Promise<string>,
  now: Date
): Promise<TipCheck> {
  if (sub.status !== 'active' && sub.status !== 'trialing') return { ok: false, code: 'not_live', message: 'No active hosting plan.' }
  if (sub.cancel_at_period_end || sub.cancel_at) return { ok: false, code: 'ending', message: 'This plan is set to end.' }
  const step = currentLadderStep(sub)
  if (!step) return { ok: false, code: 'no_tip_plan', message: 'Tips are for hosting ladder plans.' }
  // A planned switch drops the tip at the switch date; changing it now would be overwritten by the
  // schedule's next phase, so it waits until the switch has happened (or "Keep <plan>" cancels it).
  // Only a phase starting in the FUTURE counts (Vera bug 3): once the switch phase is current the
  // schedule is released here and the tip can change right away.
  // Same for an add-on removal (its next phase holds the tip it was planned with).
  if (scheduleId(sub) && (await hasPendingSwitch(stripe, sub, now))) {
    return { ok: false, code: 'pending_change', message: 'A plan change is planned.' }
  }
  // Starter: the add-ons on the plan lower the max tip (plan + add-ons + tip <= $54).
  const parsed = parseTipDollars(step, tipDollars, undefined, addonCentsOfItems(sub.items.data))
  if (!parsed.ok) return { ok: false, code: parsed.code === 'not_sellable' ? 'no_tip_plan' : 'out_of_range', message: 'That tip is outside the range for this plan.' }
  const next = parsed.tipDollars
  const item = tipItemOf(sub.items.data)
  const current = item ? (item.quantity ?? 0) : 0
  let items: Stripe.SubscriptionUpdateParams.Item[] = []
  if (next !== current) {
    if (item && next > 0) items = [{ id: item.id, quantity: next }]
    else if (item) items = [{ id: item.id, deleted: true }]
    else {
      try {
        items = [{ price: await tipPriceId(), quantity: next }]
      } catch {
        return { ok: false, code: 'price', message: 'Tips are not available right now.' }
      }
    }
  }
  return { ok: true, step, current, items }
}

/**
 * Read-only: what the next regular bill will be with a new tip (step price + tip). Uses Stripe's
 * upcoming-invoice preview with proration_behavior=none, so nothing changes today. A Stripe error is
 * thrown; the caller falls back to the computed amount.
 */
export async function previewTipChange(
  deps: { stripe: Stripe; tipPriceId: () => Promise<string> },
  sub: Sub,
  tipDollars: unknown,
  now: Date = new Date()
): Promise<TipChangePreview> {
  const check = await tipChangeItems(deps.stripe, sub, tipDollars, deps.tipPriceId, now)
  if (!check.ok) return check
  const next = typeof tipDollars === 'number' ? tipDollars : 0
  const end = subscriptionPeriodEnd(sub as Stripe.Subscription)
  const computed = check.step.monthlyCents + addonCentsOfItems(sub.items.data) + next * 100
  if (check.items.length === 0) {
    return { ok: true, step: check.step.id, tipDollars: next, nextAmountCents: computed, currency: 'usd', nextBillingAt: end ? end.toISOString() : null, unchanged: true }
  }
  const preview = await deps.stripe.invoices.createPreview({
    subscription: sub.id,
    subscription_details: { items: check.items, proration_behavior: 'none' },
  })
  return {
    ok: true,
    step: check.step.id,
    tipDollars: next,
    nextAmountCents: preview.amount_due,
    currency: preview.currency,
    nextBillingAt: end ? end.toISOString() : null,
    unchanged: false,
  }
}

/**
 * Change the monthly tip: from the next billing date, up or down, with proration_behavior=none
 * (nothing is charged or credited today). $0 deletes the tip item. Refused while a switch is planned,
 * for a plan that is ending, for a grandfathered plan and for a tip outside the step's range.
 */
export async function changeTip(
  deps: { stripe: Stripe; tipPriceId: () => Promise<string> },
  sub: Sub,
  tipDollars: unknown,
  opts: { userId?: string; now?: Date; confirmId?: unknown } = {}
): Promise<TipChangeResult> {
  const check = await tipChangeItems(deps.stripe, sub, tipDollars, deps.tipPriceId, opts.now ?? new Date())
  if (!check.ok) return check
  const next = typeof tipDollars === 'number' ? tipDollars : 0
  const end = subscriptionPeriodEnd(sub as Stripe.Subscription)
  const nextBillingAt = end ? end.toISOString() : null
  const nextAmountCents = check.step.monthlyCents + addonCentsOfItems(sub.items.data) + next * 100
  if (check.items.length === 0) return { ok: true, kind: 'unchanged', step: check.step.id, tipDollars: next, nextAmountCents, nextBillingAt }
  const updated = await deps.stripe.subscriptions.update(
    sub.id,
    { items: check.items, proration_behavior: 'none' },
    { idempotencyKey: tipChangeIdempotencyKey(opts.userId, sub.id, opts.confirmId, next) }
  )
  // Guard (Vera B2): the subscription must hold exactly the requested tip and the same step. A replayed
  // idempotent response looks right (it is the first response), so the check reads the LIVE subscription
  // too. Anything else (a replay, a concurrent edit) fails loudly; the caller writes nothing and the
  // customer sees the try-again message, never "Your tip is updated".
  const fresh = updated?.items?.data ? await deps.stripe.subscriptions.retrieve(sub.id) : updated
  const gotItems = fresh?.items?.data
  const gotTip = gotItems ? tipDollarsOfItems(gotItems) : null
  const gotStep = gotItems ? currentLadderStep(fresh as Stripe.Subscription)?.id ?? null : null
  if (gotTip !== next || gotStep !== check.step.id) {
    console.error('[changeTip] MISMATCH after Stripe update', { sub: sub.id, requestedTip: next, stripeTip: gotTip, requestedStep: check.step.id, stripeStep: gotStep })
    return { ok: false, code: 'mismatch', message: 'Stripe did not apply the requested tip.' }
  }
  return { ok: true, kind: 'changed', step: check.step.id, tipDollars: next, nextAmountCents, nextBillingAt }
}

// ------------------------------------------------------------------ add-ons (Oct 4): on / off / keep

export type AddonAction = 'on' | 'off' | 'keep'
export type AddonChangeRefusal =
  | 'not_live'
  | 'ending'
  | 'no_addon_plan'
  | 'pending_switch'
  | 'pending_addons'
  | 'already_on'
  | 'not_on'
  | 'not_pending'
  | 'over_cap'
  | 'tip_drop_needed'
  | 'price'
  | 'stale_preview'

export type AddonChangePreview =
  | {
      ok: true
      action: 'on'
      addon: AddonId
      prorationDate: number
      /** What turning it on charges today (always_invoice proration, after any customer credit). */
      amountDueCents: number
      currency: string
      /** The regular monthly bill after the change (plan + add-ons + tip). */
      nextAmountCents: number
      nextBillingAt: string | null
      tipDollarsNow: number
      /** The tip after the change: lower than now only when Starter's $54 total needs it (confirmed by the customer). */
      tipDollarsAfter: number
    }
  | {
      ok: true
      action: 'off' | 'keep'
      addon: AddonId
      /** off: the date it ends (the end of the billing period). keep: null. */
      effectiveAt: string | null
      nextAmountCents: number
      nextBillingAt: string | null
      unchanged: boolean
    }
  | { ok: false; code: AddonChangeRefusal; message: string; tipDollars?: number }

export type AddonChangeResult =
  | { ok: true; kind: 'on'; addon: AddonId; tipDollars: number; invoiceStatus: string | null }
  | { ok: true; kind: 'removal_scheduled' | 'kept' | 'unchanged'; addon: AddonId; effectiveAt: string | null }
  | { ok: false; code: 'payment_failed'; message: string }
  | { ok: false; code: AddonChangeRefusal | 'in_progress' | 'mismatch'; message: string; tipDollars?: number }

type AddonDeps = { stripe: Stripe; addonPriceIdFor: (id: AddonId) => Promise<string>; now?: () => Date; log?: (msg: string) => void }

type AddonCheck =
  | {
      ok: true
      step: PlanStep
      stepPriceId: string
      schedule: ScheduleLike | null
      phase: ScheduledPhase | null
      liveAddons: AddonId[]
      /** Add-ons after the change (on: now; off/keep: in the next phase). */
      nextAddons: AddonId[]
      tipNow: number
      /** on: the max tip after the change; the tip must come down to it when tipNow is higher. */
      tipMaxAfter: number
      unchanged: boolean
    }
  | { ok: false; code: AddonChangeRefusal; message: string; tipDollars?: number }

/** Shared checks for an add-on change (Stripe reads only: the schedule and, for on, nothing else). */
async function addonChangeCheck(stripe: Stripe, sub: Sub, addonId: unknown, action: AddonAction, now: Date): Promise<AddonCheck> {
  const addon = addonById(addonId)
  if (!addon) return { ok: false, code: 'not_on', message: 'Unknown add-on.' }
  if (sub.status !== 'active' && sub.status !== 'trialing') return { ok: false, code: 'not_live', message: 'No active hosting plan.' }
  if (sub.cancel_at_period_end || sub.cancel_at) return { ok: false, code: 'ending', message: 'This plan is set to end. Resume it first.' }
  const step = currentLadderStep(sub)
  const stepPriceId = liveStepPriceId(sub)
  // Grandfathered plans: no add-ons (they pick a step first).
  if (!step || !stepPriceId) return { ok: false, code: 'no_addon_plan', message: 'Add-ons are for the current hosting plans.' }
  const schedule = scheduleId(sub) ? await liveSchedule(stripe, sub, now) : null
  const phase = schedule ? await pendingFromSchedule(stripe, schedule, now) : null
  // A step switch ahead: every add-on change waits (the switch phase would overwrite it).
  if (schedule && (!phase || phase.step !== step.id)) return { ok: false, code: 'pending_switch', message: ADDON_PENDING_SWITCH }
  const liveAddons = addonIdsOfItems(sub.items.data)
  const liveCents = addonCentsOfItems(sub.items.data)
  const tipNow = subscriptionTipDollars(sub)
  const isOn = liveAddons.includes(addon.id)
  const pendingSet = phase ? phase.addons : liveAddons
  const base = { ok: true as const, step, stepPriceId, schedule, phase, liveAddons, tipNow, tipMaxAfter: tipNow }

  if (action === 'on') {
    if (isOn) return { ok: false, code: 'already_on', message: 'This add-on is already on.' }
    // An add-on removal ahead: turning another on waits (its next phase is already written).
    if (phase) return { ok: false, code: 'pending_addons', message: ADDON_PENDING_REMOVAL }
    const list = [
      ...addonItemsOf(sub.items.data).map((i) => ({ id: addonOfPrice(i.price)!.id, cents: (i.price.unit_amount ?? 0) * Math.max(1, i.quantity ?? 1) })),
      { id: addon.id, cents: addon.monthlyCents },
    ]
    if (!addonCapCheck(step.id, list).ok) return { ok: false, code: 'over_cap', message: ADDON_TURN_OFF_FIRST }
    const range = tipRangeFor(step, undefined, liveCents + addon.monthlyCents)
    const tipMaxAfter = Math.min(tipNow, range?.maxTip ?? 0)
    return { ...base, nextAddons: [...liveAddons, addon.id], tipMaxAfter, unchanged: false }
  }
  if (!isOn) return { ok: false, code: 'not_on', message: 'This add-on is not on.' }
  if (action === 'off') {
    const nextAddons = pendingSet.filter((a) => a !== addon.id)
    return { ...base, nextAddons, unchanged: !pendingSet.includes(addon.id) }
  }
  // keep: undo a planned removal
  if (!phase || phase.addons.includes(addon.id)) return { ok: false, code: 'not_pending', message: 'This add-on is not set to end.' }
  return { ...base, nextAddons: liveAddons.filter((a) => a === addon.id || phase.addons.includes(a)), unchanged: false }
}

/** Items for turning an add-on on now (+ the tip coming down to the new max, when needed). */
function addonOnItems(sub: Sub, priceId: string, tipNow: number, tipAfter: number): Stripe.SubscriptionUpdateParams.Item[] {
  const items: Stripe.SubscriptionUpdateParams.Item[] = [{ price: priceId, quantity: 1 }]
  const tip = tipItemOf(sub.items.data)
  if (tip && tipAfter !== tipNow) items.push(tipAfter > 0 ? { id: tip.id, quantity: tipAfter } : { id: tip.id, deleted: true })
  return items
}

export function addonIdempotencyKey(sub: Pick<Sub, 'id' | 'items' | 'latest_invoice'>, addonId: AddonId, opts: { prorationDate?: number; userId?: string; tipAfter?: number } = {}): string {
  const prices = sub.items.data.map((i) => `${i.price.id}x${i.quantity ?? 1}`).join('+')
  return `addon-on:${opts.userId ?? 'na'}:${addonId}:${opts.prorationDate ?? 'now'}:${opts.tipAfter ?? 'same'}:${sub.id}:${prices}:${idOf(sub.latest_invoice) ?? 'none'}`
}

/**
 * Read-only preview. on: Stripe's always_invoice proration preview at `prorationDate` (Confirm sends
 * it back), with the tip lowered to the new max when Starter's total needs it. off/keep: no charge;
 * the date it ends and the next bill (computed).
 */
export async function previewAddonChange(deps: AddonDeps, sub: Sub, addonId: unknown, action: AddonAction, prorationDate: number): Promise<AddonChangePreview> {
  const now = deps.now?.() ?? new Date()
  const check = await addonChangeCheck(deps.stripe, sub, addonId, action, now)
  if (!check.ok) return check
  const addon = addonById(addonId)!
  const end = subscriptionPeriodEnd(sub as Stripe.Subscription)
  const nextBillingAt = end ? end.toISOString() : null
  const stepCents = check.step.monthlyCents
  if (action === 'on') {
    let priceId: string
    try {
      priceId = await deps.addonPriceIdFor(addon.id)
    } catch {
      return { ok: false, code: 'price', message: 'This add-on is not available right now.' }
    }
    const preview = await deps.stripe.invoices.createPreview({
      subscription: sub.id,
      subscription_details: {
        items: addonOnItems(sub, priceId, check.tipNow, check.tipMaxAfter),
        proration_behavior: 'always_invoice',
        proration_date: prorationDate,
      },
    })
    return {
      ok: true,
      action: 'on',
      addon: addon.id,
      prorationDate,
      amountDueCents: preview.amount_due,
      currency: preview.currency,
      nextAmountCents: stepCents + addonCentsOfItems(sub.items.data) + addon.monthlyCents + check.tipMaxAfter * 100,
      nextBillingAt,
      tipDollarsNow: check.tipNow,
      tipDollarsAfter: check.tipMaxAfter,
    }
  }
  const nextAddonCents = addonItemsOf(sub.items.data)
    .filter((i) => check.nextAddons.includes(addonOfPrice(i.price)!.id))
    .reduce((n, i) => n + (i.price.unit_amount ?? 0) * Math.max(1, i.quantity ?? 1), 0)
  return {
    ok: true,
    action,
    addon: addon.id,
    effectiveAt: action === 'off' ? (check.phase?.effectiveAt ?? nextBillingAt) : null,
    nextAmountCents: stepCents + nextAddonCents + check.tipNow * 100,
    nextBillingAt,
    unchanged: check.unchanged,
  }
}

/**
 * Turn an add-on on (now, charged), off (at period end) or keep it (undo a planned removal).
 *   on:   items + the add-on price, always_invoice + pending_if_incomplete (a failed card applies
 *         nothing; the open invoice is voided), proration_date from the preview. When Starter's $54
 *         total needs a lower tip, `tipDropTo` must equal the new max (the customer confirmed it),
 *         else it is refused with code tip_drop_needed + the tip it would drop to. Never silent.
 *         Verified after: the live subscription must hold the add-on and that tip.
 *   off:  next schedule phase = live step + the add-ons left + the live tip (no charge, no credit).
 *   keep: the add-on goes back into the next phase; a phase equal to today's items is released.
 * The caller holds the change-plan lock.
 */
export async function changeAddon(
  deps: AddonDeps,
  sub: Sub,
  addonId: unknown,
  action: AddonAction,
  opts: { prorationDate?: number; userId?: string; tipDropTo?: unknown } = {}
): Promise<AddonChangeResult> {
  const { stripe } = deps
  const log = deps.log ?? ((m: string) => console.error(m))
  const now = deps.now?.() ?? new Date()
  const check = await addonChangeCheck(stripe, sub, addonId, action, now)
  if (!check.ok) return check
  const addon = addonById(addonId)!

  if (action === 'on') {
    if (opts.prorationDate !== undefined) {
      const c = checkProrationDate(opts.prorationDate, now)
      if (c !== 'ok') return { ok: false, code: 'stale_preview', message: `The previewed amount can't be used (${c}). Check it again.` }
    }
    if (check.tipMaxAfter < check.tipNow && opts.tipDropTo !== check.tipMaxAfter) {
      return { ok: false, code: 'tip_drop_needed', message: `Your tip will drop to $${check.tipMaxAfter}.`, tipDollars: check.tipMaxAfter }
    }
    let priceId: string
    try {
      priceId = await deps.addonPriceIdFor(addon.id)
    } catch {
      return { ok: false, code: 'price', message: 'This add-on is not available right now.' }
    }
    let updated: Stripe.Subscription
    try {
      updated = await stripe.subscriptions.update(
        sub.id,
        {
          items: addonOnItems(sub, priceId, check.tipNow, check.tipMaxAfter),
          proration_behavior: 'always_invoice',
          payment_behavior: 'pending_if_incomplete',
          ...(opts.prorationDate !== undefined ? { proration_date: opts.prorationDate } : {}),
          expand: ['latest_invoice'],
        },
        { idempotencyKey: addonIdempotencyKey(sub, addon.id, { ...opts, tipAfter: check.tipMaxAfter }) }
      )
    } catch (e) {
      if (isKeyInUse(e)) return { ok: false, code: 'in_progress', message: 'This change is already going through.' }
      if (!isCardError(e)) throw e
      return { ok: false, code: 'payment_failed', message: 'The card was not charged, so the add-on is still off.' }
    }
    if (updated.pending_update) {
      const inv = updated.latest_invoice
      const invId = idOf(inv as string | { id: string } | null)
      const invStatus = inv && typeof inv !== 'string' ? inv.status : null
      if (invId && (invStatus === 'open' || invStatus === null)) {
        await stripe.invoices.voidInvoice(invId).catch((e) => log(`[change-addon] could not void ${invId}: ${e instanceof Error ? e.message : String(e)}`))
      }
      return { ok: false, code: 'payment_failed', message: 'The card was not charged, so the add-on is still off.' }
    }
    // Same guard as changeTip (Vera B2): read the LIVE subscription; a replayed response looks right.
    const fresh = await stripe.subscriptions.retrieve(sub.id)
    const items = fresh?.items?.data ?? []
    if (!addonIdsOfItems(items).includes(addon.id) || tipDollarsOfItems(items) !== check.tipMaxAfter) {
      log(`[change-addon] MISMATCH after Stripe update on ${sub.id}: wanted ${addon.id} + tip ${check.tipMaxAfter}`)
      return { ok: false, code: 'mismatch', message: 'Stripe did not apply the change.' }
    }
    const inv = updated.latest_invoice
    return { ok: true, kind: 'on', addon: addon.id, tipDollars: check.tipMaxAfter, invoiceStatus: inv && typeof inv !== 'string' ? (inv.status ?? null) : null }
  }

  if (check.unchanged) return { ok: true, kind: 'unchanged', addon: addon.id, effectiveAt: check.phase?.effectiveAt ?? null }
  if (action === 'keep' && sameSet(check.nextAddons, check.liveAddons) && check.schedule) {
    // Nothing left to change at period end: drop the schedule.
    await releaseSchedule(stripe, check.schedule.id)
    return { ok: true, kind: 'kept', addon: addon.id, effectiveAt: null }
  }
  const effectiveAt = await scheduleNextPhase(
    stripe,
    sub,
    check.schedule,
    nextPhaseItems(sub, check.stepPriceId, check.nextAddons, check.tipNow),
    phaseMetadata(check.step.id, check.nextAddons, check.tipNow, 'addons'),
    now
  )
  return action === 'keep'
    ? { ok: true, kind: 'kept', addon: addon.id, effectiveAt: null }
    : { ok: true, kind: 'removal_scheduled', addon: addon.id, effectiveAt }
}
