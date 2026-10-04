import type Stripe from 'stripe'
// Relative import on purpose: scripts/stripe-test-setup-ladder.mjs loads this file (jiti) for the
// test-mode probes, outside Next's "@/" alias.
import { addonById, isPlanStepId, stepById, stepByLookupKey, TIP_TOTAL_RANGES, type AddonId, type PlanStep, type PlanStepId } from '../plans/ladder'
import { PRORATION_DATE_MAX_AGE_SECONDS, planMove, type PlanMove } from '../plans/plan-direction'
import { subscriptionPeriodEnd, subscriptionPeriodStart } from './subscription-dates'
import { parseTipDollars, tierItems, tipItemOf, tipDollarsOfItems, tipRangeFor } from '../plans/tips'
import {
  ADDON_APPLIED_META,
  ADDON_FIRST_PERIOD_KIND,
  ADDON_REFUND_CARD_META,
  ADDON_REFUND_CREDIT_META,
  ADDON_REFUND_REASON_META,
  ADDON_REFUNDED_META,
  addonRefundOf,
  addonRefundSplit,
} from './addon-refund-info'
import { REMOVAL_RESCHEDULE_TRIES, withRetries } from './retry'
import type { RemovalOwedInput } from './addon-removal-owed'
import { ADDON_MIN_CHARGE_CENTS, addonCapCheck, addonCentsInTipTotal, addonCentsOfItems, addonIdsOfItems, addonItemsOf, addonOfPrice, parseAddonIds } from '../plans/addons'
import { ADDON_NAMES, ADDON_PENDING_REMOVAL, ADDON_PENDING_SWITCH, ADDON_PRICE_UNCONFIRMED, ADDON_REFUND_REASONS, ADDON_TURN_OFF_FIRST, type AddonRefundReason } from '../plans/ladder-copy'

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
 *   - turning one ON charges its FULL monthly price now (Aria, Oct 4 8:28 AM: no partial-month
 *     amount), as a one-off invoice paid before the item is added; the item is then added with
 *     proration_behavior=none, so the next renewal bills the normal monthly amount;
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
      /** L-1: the removal could not be put back; true = saved as owed (the self-heal refunds), false = not saved. */
      removalOwed?: boolean
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
  /** Add-on first-period charge (changeAddon on): the customer to invoice and the card the plan uses. */
  customer?: string | { id: string } | null
  default_payment_method?: string | { id: string } | null
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
  deps: {
    stripe: Stripe
    priceIdFor: (id: PlanStepId) => Promise<string>
    now?: () => Date
    log?: (msg: string) => void
    /** L-1: the removal could not be put back after 3 tries: save the flag + alert us (recordRemovalOwed). */
    onRemovalOwed?: (o: RemovalOwedInput) => Promise<{ saved: boolean } | unknown>
    /** Backoff between the re-schedule tries (tests). */
    sleep?: (ms: number) => Promise<void>
  },
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
    // L-1 (Aria 9:57): retried 3 times with backoff; still failing = the removal is OWED (flag on our side +
    // internal alert); the invoice.paid self-heal removes the item and refunds its renewal line once.
    let addonRemovalKept: boolean | null = null
    let removalOwed: boolean | undefined
    const liveAddons = addonIdsOfItems(sub.items.data)
    if (restore && !sameSet(restore.addons, liveAddons) && updated.items?.data) {
      const left = liveAddons.filter((a) => restore.addons.includes(a))
      try {
        await withRetries(
          async (attempt) => {
            // A later try re-reads: an earlier try may have attached a schedule before failing.
            let base: Pick<Stripe.Subscription, 'id' | 'items'> = updated
            let existing: ScheduleLike | null = null
            if (attempt > 1) {
              const fresh = await stripe.subscriptions.retrieve(sub.id)
              base = fresh
              const schedId = idOf(fresh.schedule as string | { id: string } | null)
              existing = schedId ? ((await stripe.subscriptionSchedules.retrieve(schedId)) as unknown as ScheduleLike) : null
            }
            await scheduleNextPhase(stripe, base, existing, nextPhaseItems(base, priceId, left, 0), phaseMetadata(target.id, left, 0, 'addons'), now)
          },
          {
            sleep: deps.sleep,
            onFail: (attempt, e) => log(`[change-plan] re-schedule of the add-on removal on ${sub.id} failed (try ${attempt}/${REMOVAL_RESCHEDULE_TRIES}): ${e instanceof Error ? e.message : String(e)}`),
          }
        )
        addonRemovalKept = true
      } catch {
        addonRemovalKept = false
        const owed: RemovalOwedInput = {
          subscriptionId: sub.id,
          customerId: idOf(sub.customer ?? null),
          userId: opts.userId ?? null,
          addons: liveAddons.filter((a) => !restore.addons.includes(a)),
          effectiveAt: restore.effectiveAt,
        }
        log(`[change-plan] REMOVAL OWED on ${sub.id}: ${owed.addons.join(',')} from ${owed.effectiveAt}`)
        if (deps.onRemovalOwed) {
          const r = await deps.onRemovalOwed(owed).catch((e: unknown) => {
            log(`[change-plan] REMOVAL OWED NOT SAVED on ${sub.id}: ${e instanceof Error ? e.message : String(e)}`)
            return { saved: false }
          })
          removalOwed = !(r && typeof r === 'object' && 'saved' in r && r.saved === false)
        } else {
          log(`[change-plan] REMOVAL OWED NOT SAVED on ${sub.id}: no store`)
          removalOwed = false
        }
      }
    }
    return {
      ok: true,
      kind: 'upgraded',
      step: target.id,
      invoiceStatus: inv && typeof inv !== 'string' ? (inv.status ?? null) : null,
      ...(addonRemovalKept !== null ? { addonRemovalKept } : {}),
      ...(removalOwed !== undefined ? { removalOwed } : {}),
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
  // Vera M-1 (Aria, Oct 4 9:28): releasing the schedule also drops a planned add-on removal. Remember
  // it on the subscription (same update as the cancel), so a resume puts the removal back and a turned-off
  // add-on never renews.
  const removed = cleared?.removedAddons ?? []
  const periodEnd = subscriptionPeriodEnd(sub as Stripe.Subscription)
  const remember =
    removed.length > 0 && periodEnd
      ? { metadata: { [RESUME_REMOVE_ADDONS_META]: removed.join(','), [RESUME_REMOVE_AT_META]: String(Math.floor(periodEnd.getTime() / 1000)) } }
      : {}
  // One key per cancel (the caller holds the change-plan lock): a fixed key would replay the first
  // cancel's response for 24 h after a resume, so a second cancel would silently do nothing.
  await stripe.subscriptions.update(
    sub.id,
    { cancel_at_period_end: true, ...remember },
    { idempotencyKey: `plan-cancel:${sub.id}:${released ?? 'none'}:${crypto.randomUUID()}` }
  )
  return { ok: true, kind: 'canceled', clearedPendingChange: cleared }
}

/** Subscription metadata set by a cancel that dropped a planned add-on removal (Vera M-1). */
export const RESUME_REMOVE_ADDONS_META = 'freeplug_resume_remove_addons'
/** The period end (unix seconds) the removal was planned for; a different period = stale, ignored. */
export const RESUME_REMOVE_AT_META = 'freeplug_resume_remove_at'

export type ResumeResult = {
  resumed: boolean
  restoredRemoval: AddonId[]
  /** Aria 10:09 (option A): the removal couldn't be put back; the plan stays on and the removal is owed. */
  removalOwed?: AddonId[]
}

export type ResumeOptions = {
  userId?: string | null
  /** Save the owed flag + alert us (recordRemovalOwedNow('resume')). Without it, a failed put-back undoes the resume. */
  onRemovalOwed?: (o: RemovalOwedInput) => Promise<{ saved: boolean } | unknown>
  sleep?: (ms: number) => Promise<void>
  log?: (msg: string) => void
}

/**
 * Resume a plan that is set to end (Restart hosting / Resume plan), and put back an add-on removal the
 * cancel dropped (Vera M-1, Aria Oct 4 9:28): the same next phase as turning it off (live step + the
 * add-ons left + the live tip, at period end). Putting it back is retried (3 tries, 0.5 s / 1.5 s).
 * Still failing (Aria 10:09, option A): the plan STAYS resumed and the removal is OWED (flag + internal
 * alert, source 'resume'); the renewal's invoice.paid removes the add-on and refunds its line (L-1). No
 * draft-invoice stripping. Only when the flag can't be saved at all is the resume undone (set to end
 * again) and this throws: a turned-off add-on must never renew unrecorded. The caller holds the lock.
 */
export async function resumeSubscription(stripe: Stripe, subIn: Sub, now: Date = new Date(), opts: ResumeOptions = {}): Promise<ResumeResult> {
  const log = opts.log ?? ((m: string) => console.error(m))
  if (subIn.cancel_at_period_end !== true && subIn.cancel_at == null) return { resumed: false, restoredRemoval: [] }
  // Stripe returns BOTH cancel_at_period_end=true and cancel_at after a cancel at period end, and refuses
  // an update that sends both (Vera 5b R1): clear only cancel_at_period_end; a cancel_at on its own is ''.
  const undo = subIn.cancel_at_period_end === true ? { cancel_at_period_end: true } : { cancel_at: subIn.cancel_at as number }
  await stripe.subscriptions.update(subIn.id, subIn.cancel_at_period_end === true ? { cancel_at_period_end: false } : { cancel_at: '' })
  const meta = ((subIn as { metadata?: Record<string, string> | null }).metadata ?? {}) as Record<string, string | undefined>
  const removed = parseAddonIds((meta[RESUME_REMOVE_ADDONS_META] ?? '').split(',').filter(Boolean)) ?? []
  if (!meta[RESUME_REMOVE_ADDONS_META]) return { resumed: true, restoredRemoval: [] }
  const clear = { metadata: { [RESUME_REMOVE_ADDONS_META]: '', [RESUME_REMOVE_AT_META]: '' } }
  const clearMarker = () =>
    stripe.subscriptions.update(subIn.id, clear).then(
      () => undefined,
      // A marker left behind is harmless: it names this period only, and a later resume ignores a stale one.
      (e: unknown) => log(`[resume] could not clear the removal marker on ${subIn.id}: ${e instanceof Error ? e.message : String(e)}`)
    )
  let toRemove: AddonId[] = removed
  try {
    const restored = await withRetries(
      async (attempt) => {
        const sub = (await stripe.subscriptions.retrieve(subIn.id)) as unknown as Sub
        const end = subscriptionPeriodEnd(sub as Stripe.Subscription)
        const forThisPeriod = end && String(Math.floor(end.getTime() / 1000)) === meta[RESUME_REMOVE_AT_META]
        const live = addonIdsOfItems(sub.items.data)
        const keep = live.filter((a) => !removed.includes(a))
        toRemove = live.filter((a) => removed.includes(a))
        const step = currentLadderStep(sub)
        const stepPriceId = liveStepPriceId(sub)
        if (!(forThisPeriod && keep.length < live.length && step && stepPriceId)) return [] as AddonId[]
        // A later try re-reads the schedule an earlier try may have attached before failing.
        const schedId = attempt > 1 ? idOf(sub.schedule as string | { id: string } | null) : null
        const existing = schedId ? ((await stripe.subscriptionSchedules.retrieve(schedId)) as unknown as ScheduleLike) : null
        await scheduleNextPhase(stripe, sub, existing, nextPhaseItems(sub, stepPriceId, keep, subscriptionTipDollars(sub)), phaseMetadata(step.id, keep, subscriptionTipDollars(sub), 'addons'), now)
        return toRemove
      },
      {
        sleep: opts.sleep,
        onFail: (attempt, e) => log(`[resume] put-back of the add-on removal on ${subIn.id} failed (try ${attempt}/${REMOVAL_RESCHEDULE_TRIES}): ${e instanceof Error ? e.message : String(e)}`),
      }
    )
    await clearMarker()
    return { resumed: true, restoredRemoval: restored }
  } catch (e) {
    const at = Number(meta[RESUME_REMOVE_AT_META])
    const owed: RemovalOwedInput = {
      subscriptionId: subIn.id,
      customerId: idOf(subIn.customer ?? null),
      userId: opts.userId ?? null,
      addons: toRemove.length > 0 ? toRemove : removed,
      effectiveAt: Number.isFinite(at) && at > 0 ? new Date(at * 1000).toISOString() : (subscriptionPeriodEnd(subIn as Stripe.Subscription) ?? now).toISOString(),
    }
    log(`[resume] REMOVAL OWED on ${subIn.id}: ${owed.addons.join(',')} from ${owed.effectiveAt}`)
    let saved = false
    if (opts.onRemovalOwed) {
      const r = await opts.onRemovalOwed(owed).catch((err: unknown) => {
        log(`[resume] REMOVAL OWED NOT SAVED on ${subIn.id}: ${err instanceof Error ? err.message : String(err)}`)
        return { saved: false }
      })
      saved = !(r && typeof r === 'object' && 'saved' in r && r.saved === false)
    }
    if (saved) {
      await clearMarker()
      return { resumed: true, restoredRemoval: [], removalOwed: owed.addons }
    }
    log(`[resume] could not put back the add-on removal on ${subIn.id} and no owed flag was saved; setting it to end again`)
    await stripe.subscriptions.update(subIn.id, undo).catch((u: unknown) => log(`[resume] UNDO FAILED on ${subIn.id}: ${u instanceof Error ? u.message : String(u)}`))
    throw e
  }
}

export {
  ADDON_APPLIED_META,
  ADDON_FIRST_PERIOD_KIND,
  ADDON_REFUND_CARD_META,
  ADDON_REFUND_CREDIT_META,
  ADDON_REFUND_REASON_META,
  ADDON_REFUNDED_META,
  addonRefundOf,
  addonRefundSplit,
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
  /** Aria 9:27: the charge total isn't exactly the add-on price (a discount or tax): refused, logged. */
  | 'price_mismatch'
  | 'stale_preview'


/** A refusal; pending_switch carries the switch date from the schedule (the lock line shows it). */
export type AddonRefusal = { ok: false; code: AddonChangeRefusal; message: string; tipDollars?: number; switchAt?: string | null }

export type AddonChangePreview =
  | {
      ok: true
      action: 'on'
      addon: AddonId
      /** When the preview was made (server time); Confirm sends it back and it expires like an upgrade preview. */
      prorationDate: number
      /**
       * What turning it on REALLY charges today (Aria, Oct 4 8:59): Stripe's own preview of a full-price
       * invoice for this customer, with their account credit applied. 0 = credit covers all of it.
       */
      amountDueCents: number
      /** The add-on's full monthly price (what the invoice totals before credit). */
      fullCents: number
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
  | AddonRefusal

export type AddonChangeResult =
  /** deferredCents: under $0.50 after credit, nothing charged now; Stripe adds it to the next invoice (Aria 9:27). */
  | { ok: true; kind: 'on'; addon: AddonId; tipDollars: number; invoiceStatus: string | null; invoiceId: string | null; deferredCents?: number }
  | { ok: true; kind: 'removal_scheduled' | 'kept' | 'unchanged'; addon: AddonId; effectiveAt: string | null }
  | { ok: false; code: 'payment_failed'; message: string }
  /** Charged, but Stripe did not add the item: the charge is refunded (refunded=false: the refund failed too, logged). */
  | { ok: false; code: 'not_applied'; message: string; refunded: boolean; refundCardCents?: number; refundCreditCents?: number; invoiceId?: string }
  /** Paid, the item not confirmed yet (a transient Stripe error): the invoice.paid self-heal finishes it or refunds. */
  | { ok: false; code: 'finishing'; message: string; invoiceId: string }
  | AddonRefusal
  | { ok: false; code: 'in_progress' | 'mismatch'; message: string }

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
  | AddonRefusal

/**
 * When the switch in a schedule happens: the next phase start on the subscription's clock (a test
 * clock's frozen time, else now); with the clock past every start but current_phase not moved yet,
 * the last phase. ISO string, or null.
 */
async function scheduleSwitchAt(stripe: Stripe, schedule: ScheduleLike, now: Date): Promise<string | null> {
  const nowSec = Math.floor((await subscriptionClockNow(stripe, schedule, now)).getTime() / 1000)
  const next = schedule.phases.find((p) => p.start_date > nowSec) ?? schedule.phases[schedule.phases.length - 1]
  return next ? new Date(next.start_date * 1000).toISOString() : null
}

/** Shared checks for an add-on change (Stripe reads only: the schedule and, for on, nothing else). */
export async function addonChangeCheck(stripe: Stripe, sub: Sub, addonId: unknown, action: AddonAction, now: Date): Promise<AddonCheck> {
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
  // A step switch ahead: every add-on change waits (the switch phase would overwrite it). Aria, Oct 4
  // 8:59: KEEP this lock (on, off and keep), with the switch date from the schedule in the refusal.
  if (schedule && (!phase || phase.step !== step.id)) {
    return { ok: false, code: 'pending_switch', message: ADDON_PENDING_SWITCH, switchAt: phase?.effectiveAt ?? (await scheduleSwitchAt(stripe, schedule, now)) }
  }
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
export function addonOnItems(sub: Sub, priceId: string, tipNow: number, tipAfter: number): Stripe.SubscriptionUpdateParams.Item[] {
  const items: Stripe.SubscriptionUpdateParams.Item[] = [{ price: priceId, quantity: 1 }]
  const tip = tipItemOf(sub.items.data)
  if (tip && tipAfter !== tipNow) items.push(tipAfter > 0 ? { id: tip.id, quantity: tipAfter } : { id: tip.id, deleted: true })
  return items
}

export function addonIdempotencyKey(sub: Pick<Sub, 'id' | 'items' | 'latest_invoice'>, addonId: AddonId, opts: { prorationDate?: number; userId?: string; tipAfter?: number } = {}): string {
  const prices = sub.items.data.map((i) => `${i.price.id}x${i.quantity ?? 1}`).join('+')
  return `addon-on:${opts.userId ?? 'na'}:${addonId}:${opts.prorationDate ?? 'now'}:${opts.tipAfter ?? 'same'}:${sub.id}:${prices}:${idOf(sub.latest_invoice) ?? 'none'}`
}


/** Stripe metadata values are capped at 500 characters: a longer key keeps its start + a short hash. */
export function addonKeyForMetadata(key: string): string {
  if (key.length <= 500) return key
  let h = 0x811c9dc5
  for (let i = 0; i < key.length; i++) h = Math.imul(h ^ key.charCodeAt(i), 0x01000193) >>> 0
  return `${key.slice(0, 480)}:fnv${h.toString(16)}`
}

/** What the charge carries so the invoice.paid self-heal can finish (or refund) it without the request. */
export type AddonChargeContext = { userId?: string; priceId: string; tipBefore: number; tipAfter: number }

async function markAddonInvoice(stripe: Stripe, invoiceId: string, metadata: Record<string, string>, log: (m: string) => void): Promise<void> {
  try {
    await stripe.invoices.update(invoiceId, { metadata })
  } catch (e) {
    // The checks behind the marker (item on the subscription, credit notes) still hold; logged only.
    log(`[change-addon] could not mark ${invoiceId} ${Object.keys(metadata).join(',')}: ${e instanceof Error ? e.message : String(e)}`)
  }
}

type AddonCharge =
  | { ok: true; invoiceId: string; amountPaidCents: number }
  | { ok: false; code: 'payment_failed' | 'in_progress' | 'stale' | 'price' }

/**
 * Turning an add-on on: charge its full monthly price NOW as its own invoice (Aria, Oct 4), paid
 * before the subscription changes. The invoice excludes pending invoice items (nothing else rides
 * along) and has no subscription, so the webhook books it once in billing_ledger / Total Paid (by
 * invoice id, like every paid invoice) and the outreach "first invoice" hook ignores it. Paid with
 * the plan's card (subscription default, else the customer's default), off session. A declined,
 * unpaid or wrong-total invoice is voided (a draft is deleted) and nothing changes.
 */
/** The add-on's first-period invoice line: "Add-on: +1 small edit (this billing period)". */
export const addonInvoiceLineDescription = (addonId: AddonId) => `Add-on: ${ADDON_NAMES[addonId]} (this billing period)`

async function chargeAddonFirstPeriod(
  stripe: Stripe,
  sub: Sub,
  addonId: AddonId,
  cents: number,
  key: string,
  ctx: AddonChargeContext,
  log: (m: string) => void
): Promise<AddonCharge> {
  const customer = idOf(sub.customer ?? null)
  if (!customer) {
    log(`[change-addon] ${sub.id} has no customer to charge`)
    return { ok: false, code: 'payment_failed' }
  }
  const pm = idOf(sub.default_payment_method ?? null)
  // Self-heal (Aria, Oct 4 8:59): add-on key, user id and the idempotency key, plus what the item
  // update needs (price, confirmed tip), so invoice.paid can finish it if this request dies after paying.
  const metadata = {
    freeplug_kind: ADDON_FIRST_PERIOD_KIND,
    addon: addonId,
    subscription: sub.id,
    user_id: ctx.userId ?? '',
    idempotency_key: addonKeyForMetadata(key),
    price: ctx.priceId,
    tip_before: String(ctx.tipBefore),
    tip_after: String(ctx.tipAfter),
  }
  // Aria 10:09: the customer sees this line on the Stripe invoice: the display name, not the raw id.
  const description = addonInvoiceLineDescription(addonId)
  let invId: string | null = null
  let finalized = false
  const undo = async () => {
    if (!invId) return
    const id = invId
    const p = finalized ? stripe.invoices.voidInvoice(id) : stripe.invoices.del(id)
    await p.catch((e: unknown) => log(`[change-addon] could not ${finalized ? 'void' : 'delete'} ${id}: ${e instanceof Error ? e.message : String(e)}`))
  }
  try {
    const inv = await stripe.invoices.create(
      {
        customer,
        collection_method: 'charge_automatically',
        auto_advance: false,
        pending_invoice_items_behavior: 'exclude',
        currency: 'usd',
        description,
        metadata,
        ...(pm ? { default_payment_method: pm } : {}),
      },
      { idempotencyKey: `${key}:invoice` }
    )
    invId = inv.id
    // A replay of a key that already ran: paid = done; void/uncollectible = that try failed (re-preview).
    if (inv.status === 'paid') return { ok: true, invoiceId: inv.id, amountPaidCents: inv.amount_paid ?? cents }
    if (inv.status === 'void' || inv.status === 'uncollectible') return { ok: false, code: 'stale' }
    let open = inv
    if (inv.status === 'draft') {
      await stripe.invoiceItems.create({ customer, invoice: inv.id, amount: cents, currency: 'usd', description, metadata }, { idempotencyKey: `${key}:item` })
      open = await stripe.invoices.finalizeInvoice(inv.id, { auto_advance: false }, { idempotencyKey: `${key}:finalize` })
    }
    finalized = true
    // Exactly the add-on price, nothing else (no tax lines, no other items): else don't charge.
    if (open.total !== cents) {
      log(`[change-addon] ${inv.id} total ${open.total} != ${cents}; voiding`)
      await undo()
      return { ok: false, code: 'price' }
    }
    const paid = open.status === 'paid' ? open : await stripe.invoices.pay(inv.id, { off_session: true }, { idempotencyKey: `${key}:pay` })
    if (paid.status !== 'paid') {
      await undo()
      return { ok: false, code: 'payment_failed' }
    }
    return { ok: true, invoiceId: inv.id, amountPaidCents: paid.amount_paid ?? cents }
  } catch (e) {
    if (isKeyInUse(e)) return { ok: false, code: 'in_progress' }
    await undo()
    if (isCardError(e)) return { ok: false, code: 'payment_failed' }
    throw e
  }
}

/**
 * Refund an add-on charge whose item could not be added (credit note: the card part refunded, any
 * account-credit part credited back). Idempotent: an invoice already marked refunded, or already
 * credited for its full total, is done (a credit note key only lasts 24 h; Stripe also refuses to
 * credit more than the invoice total). Marks the invoice addon_refunded after.
 */
export type AddonRefundOutcome = { ok: boolean; cardCents: number; creditCents: number }

export async function refundAddonCharge(
  stripe: Stripe,
  invoiceId: string,
  amountPaidCents: number,
  cents: number,
  log: (m: string) => void,
  reason: AddonRefundReason = 'not_added',
  /** L-1: extra invoice marks (which turned-off add-ons) and the add-on name(s) for the memo. */
  opts: { extraMarks?: Record<string, string>; addonName?: string } = {}
): Promise<AddonRefundOutcome> {
  const split = addonRefundSplit(amountPaidCents, cents)
  const marks = { ...refundMarks(reason, split), ...(opts.extraMarks ?? {}) }
  try {
    const inv = await stripe.invoices.retrieve(invoiceId)
    const meta = (inv.metadata ?? {}) as Record<string, string | undefined>
    if (meta[ADDON_REFUNDED_META] || (inv.post_payment_credit_notes_amount ?? 0) >= cents) {
      log(`[change-addon] ${invoiceId} already refunded`)
      // Re-mark when the marker was lost (the credit note exists): the Plans note and the email read it.
      if (!meta[ADDON_REFUNDED_META]) await markAddonInvoice(stripe, invoiceId, marks, log)
      return { ok: true, ...split }
    }
    const refund = split.cardCents
    await stripe.creditNotes.create(
      {
        invoice: invoiceId,
        amount: cents,
        ...(refund > 0 ? { refund_amount: refund } : {}),
        ...(cents - refund > 0 ? { credit_amount: cents - refund } : {}),
        reason: 'order_change',
        // Aria 10:09: the memo is the refund reason's sentence, so it matches the email and the notes.
        memo: ADDON_REFUND_REASONS[reason](opts.addonName ?? memoName(meta.addon)),
      },
      { idempotencyKey: `addon-refund:${invoiceId}` }
    )
    log(`[change-addon] REFUNDED ${invoiceId} (reason ${reason}): ${refund} to the card, ${cents - refund} as account credit`)
    await markAddonInvoice(stripe, invoiceId, marks, log)
    return { ok: true, ...split }
  } catch (e) {
    log(`[change-addon] REFUND FAILED for ${invoiceId} (reason ${reason}): ${e instanceof Error ? e.message : String(e)}`)
    return { ok: false, ...split }
  }
}

const memoName = (addon: string | undefined) => {
  const a = addonById(addon)
  return a ? ADDON_NAMES[a.id] : 'the add-on'
}

const refundMarks = (reason: AddonRefundReason, split: { cardCents: number; creditCents: number }) => ({
  [ADDON_REFUNDED_META]: 'true',
  [ADDON_REFUND_REASON_META]: reason,
  [ADDON_REFUND_CARD_META]: String(split.cardCents),
  [ADDON_REFUND_CREDIT_META]: String(split.creditCents),
})

/**
 * Read-only preview. on: the add-on's full monthly price today (no Stripe preview needed: it is
 * never prorated) and the tip it would drop to when Starter's total needs it; `prorationDate` is the
 * preview time Confirm sends back. off/keep: no charge;
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
    // The REAL amount (Aria, Oct 4 8:59), the same way as the upgrade confirm: a server-side Stripe
    // preview with the customer's account credit applied. A customer-only preview would show their
    // next subscription renewal, so this previews a NEW subscription holding only the add-on price:
    // one full-price invoice billed today, credit applied, exactly like the one-off charge.
    const customer = idOf(sub.customer ?? null)
    if (!customer) throw new Error(`${sub.id} has no customer to preview`)
    const preview = await deps.stripe.invoices.createPreview({ customer, subscription_details: { items: [{ price: priceId, quantity: 1 }] } })
    // Anything but exactly the add-on price (a discount, tax, another line) would be refused at the
    // charge anyway ('price'): no confirm with a number we can't stand behind (the caller falls back).
    if (preview.total !== addon.monthlyCents) {
      ;(deps.log ?? ((m: string) => console.error(m)))(`[change-addon] PRICE NOT CONFIRMED (preview) ${sub.id} ${addon.id}: total ${preview.total} != ${addon.monthlyCents} (discount or tax on the account?)`)
      throw new Error(`add-on preview total ${preview.total} != ${addon.monthlyCents}`)
    }
    return {
      ok: true,
      action: 'on',
      addon: addon.id,
      prorationDate,
      amountDueCents: Math.max(0, Math.min(addon.monthlyCents, preview.amount_due)),
      fullCents: addon.monthlyCents,
      currency: preview.currency ?? 'usd',
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
 *   on:   the full monthly price as a one-off invoice, paid first (a declined or unpaid charge is
 *         voided and nothing changes), then the add-on item with proration none (refunded with a
 *         credit note if Stripe doesn't apply it). When Starter's $54
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
    const key = addonIdempotencyKey(sub, addon.id, {
      ...opts,
      // No preview time (a direct call): one key per minute, so a later retry is a new charge attempt.
      prorationDate: opts.prorationDate ?? Math.floor(now.getTime() / 60_000) * 60,
      tipAfter: check.tipMaxAfter,
    })
    // 0. What it charges today, from Stripe's preview (credit applied), like the confirm (a read).
    //    Not exactly the add-on price (a discount or tax on the account) = refused (Aria 9:27).
    //    Above $0 and below $0.50 = not charged now: on with the amount on the next bill (Aria 9:27).
    const customer = idOf(sub.customer ?? null)
    let amountDue: number | null = null
    if (customer) {
      try {
        const pv = await stripe.invoices.createPreview({ customer, subscription_details: { items: [{ price: priceId, quantity: 1 }] } })
        if (pv.total !== addon.monthlyCents) {
          log(`[change-addon] PRICE NOT CONFIRMED ${sub.id} ${addon.id}: preview total ${pv.total} != ${addon.monthlyCents} (discount or tax?); refused, nothing charged`)
          return { ok: false, code: 'price_mismatch', message: ADDON_PRICE_UNCONFIRMED }
        }
        amountDue = Math.max(0, Math.min(addon.monthlyCents, pv.amount_due))
      } catch (e) {
        // No preview: the charge path decides (its own total check refuses a wrong total).
        log(`[change-addon] preview before the charge failed on ${sub.id}: ${errMsg(e)}`)
      }
    }
    // Above $0 and below $0.50 after credit (Aria 9:27, 9:57): the SAME charge path. The credit is used
    // now; Stripe marks a too-small invoice paid with nothing charged and adds the rest to the next
    // invoice (invoice_too_small debit). We don't promise anything about the credit later.
    const smallCents = amountDue !== null && amountDue > 0 && amountDue < ADDON_MIN_CHARGE_CENTS ? amountDue : null
    // 1. The full price, charged and PAID before anything changes on the subscription.
    const ctx: AddonChargeContext = { userId: opts.userId, priceId, tipBefore: check.tipNow, tipAfter: check.tipMaxAfter }
    const charge = await chargeAddonFirstPeriod(stripe, sub, addon.id, addon.monthlyCents, key, ctx, log)
    if (!charge.ok) {
      if (charge.code === 'in_progress') return { ok: false, code: 'in_progress', message: 'This change is already going through.' }
      if (charge.code === 'stale') return { ok: false, code: 'stale_preview', message: 'This charge was already tried. Check it again.' }
      if (charge.code === 'price') {
        log(`[change-addon] PRICE NOT CONFIRMED ${sub.id} ${addon.id}: invoice total != ${addon.monthlyCents}; voided, nothing charged`)
        return { ok: false, code: 'price_mismatch', message: ADDON_PRICE_UNCONFIRMED }
      }
      return { ok: false, code: 'payment_failed', message: 'The card was not charged, so the add-on is still off.' }
    }
    // Nothing reached the card (paid by Stripe's invoice_too_small rule): the amount is on the next bill.
    const deferred: { deferredCents?: number } = smallCents !== null && charge.amountPaidCents === 0 ? { deferredCents: smallCents } : {}
    // 2. Then the item, with no proration (this period is paid by the charge above); the next
    // renewal bills it at the normal monthly price. A tip drop applies from that renewal too.
    // Anything short of a verified item goes through the SAME self-heal as the invoice.paid webhook
    // (we hold the user's lock): it adds the item, or refunds when it can't; a transient Stripe
    // error leaves it to the webhook ("finishing").
    const finish = async (why: string): Promise<AddonChangeResult> => {
      log(`[change-addon] ${why} on ${sub.id} after charging ${charge.invoiceId}; self-heal`)
      let healed: AddonHealResult
      try {
        healed = await healAddonCharge(deps, charge.invoiceId)
      } catch (e) {
        log(`[change-addon] self-heal threw for ${charge.invoiceId}: ${e instanceof Error ? e.message : String(e)}`)
        healed = { outcome: 'retry', reason: 'threw' }
      }
      if (healed.outcome === 'applied' || healed.outcome === 'already_applied') {
        return { ok: true, kind: 'on', addon: addon.id, tipDollars: check.tipMaxAfter, invoiceStatus: 'paid', invoiceId: charge.invoiceId, ...deferred }
      }
      const money = { refundCardCents: healed.cardCents, refundCreditCents: healed.creditCents, invoiceId: charge.invoiceId }
      if (healed.outcome === 'refunded' || healed.outcome === 'already_refunded') return { ok: false, code: 'not_applied', message: 'Stripe did not add the add-on.', refunded: true, ...money }
      if (healed.outcome === 'refund_failed') return { ok: false, code: 'not_applied', message: 'Stripe did not add the add-on.', refunded: false, ...money }
      return { ok: false, code: 'finishing', message: 'Paid; the add-on is being added.', invoiceId: charge.invoiceId }
    }
    try {
      await stripe.subscriptions.update(
        sub.id,
        { items: addonOnItems(sub, priceId, check.tipNow, check.tipMaxAfter), proration_behavior: 'none' },
        { idempotencyKey: `${key}:sub` }
      )
    } catch (e) {
      return finish(`subscription update failed (${e instanceof Error ? e.message : String(e)})`)
    }
    // Same guard as changeTip (Vera B2): read the LIVE subscription; a replayed response looks right.
    const fresh = await stripe.subscriptions.retrieve(sub.id)
    const items = fresh?.items?.data ?? []
    const added = addonItemsOf(items).find((i) => addonOfPrice(i.price)?.id === addon.id)
    if (!added || tipDollarsOfItems(items) !== check.tipMaxAfter) {
      return finish(`MISMATCH (wanted ${addon.id} + tip ${check.tipMaxAfter})`)
    }
    await markAddonInvoice(stripe, charge.invoiceId, { [ADDON_APPLIED_META]: added.id }, log)
    if (deferred.deferredCents) log(`[change-addon] ${addon.id} on for ${sub.id}; ${deferred.deferredCents} cents went to the next invoice (invoice_too_small)`)
    return { ok: true, kind: 'on', addon: addon.id, tipDollars: check.tipMaxAfter, invoiceStatus: 'paid', invoiceId: charge.invoiceId, ...deferred }
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

// ------------------------------------------------------------------ add-on self-heal (Aria, Oct 4 8:59)

export type AddonHealOutcome =
  | 'not_addon'
  | 'not_paid'
  | 'already_applied'
  | 'applied'
  | 'already_refunded'
  | 'refunded'
  | 'refund_failed'
  /** A transient Stripe error (connection, 5xx, rate limit, key in use): try again later (webhook: non-2xx). */
  | 'retry'
export type AddonHealResult = {
  outcome: AddonHealOutcome
  reason?: string
  addon?: AddonId
  /** Refunded / refund_failed / already_refunded: why (shown to the customer) and where the money went. */
  refundReason?: AddonRefundReason
  cardCents?: number
  creditCents?: number
}

/** Aria 9:27: the plain-English reason for a refusal found by the self-heal. */
export function refundReasonForRefusal(code: AddonChangeRefusal): AddonRefundReason {
  if (code === 'pending_switch') return 'switch_pending'
  if (code === 'pending_addons') return 'removal_pending'
  if (code === 'not_live' || code === 'ending') return 'plan_ended'
  return 'not_added'
}

const errMsg = (e: unknown) => (e instanceof Error ? e.message : String(e))
const isMissingResource = (e: unknown) => !!e && typeof e === 'object' && (e as { code?: string }).code === 'resource_missing'
/** Errors worth another try later (Stripe's retryable set); anything else is a definite "can't". */
export function isRetryableStripeError(e: unknown): boolean {
  if (!e || typeof e !== 'object') return true
  const x = e as { type?: string; code?: string; statusCode?: number }
  if (x.type === 'StripeConnectionError' || x.type === 'StripeAPIError' || x.type === 'StripeRateLimitError') return true
  if (x.code === 'idempotency_key_in_use' || x.code === 'lock_timeout' || x.code === 'rate_limit') return true
  return typeof x.statusCode === 'number' ? x.statusCode >= 500 || x.statusCode === 409 || x.statusCode === 429 : !x.type
}

/**
 * Finish a PAID add-on charge (the one-off invoice changeAddon creates): make sure the add-on item is
 * on the subscription, or refund when it can't be (Aria, Oct 4 8:59). Called from the invoice.paid
 * webhook (under the user's change-plan lock) and inline by changeAddon when its own update didn't
 * verify. Idempotent and safe to repeat:
 *   - reads the invoice FRESH from Stripe (never the event payload): marked applied / refunded = done;
 *   - the item already on the subscription = applied (marked), never a second item;
 *   - can't be added (subscription gone / not live / ending, the add-on or its price gone, a switch or
 *     removal scheduled, the period it paid for over, a tip drop the customer didn't confirm) =
 *     refunded with an idempotent credit note, logged;
 *   - else the item is added with the tip the customer confirmed (proration none, Stripe idempotency
 *     key from the charge's metadata), then verified on the live subscription.
 */
export async function healAddonCharge(deps: AddonDeps, invoiceId: string): Promise<AddonHealResult> {
  const { stripe } = deps
  const log = deps.log ?? ((m: string) => console.error(m))
  const now = deps.now?.() ?? new Date()
  const inv = await stripe.invoices.retrieve(invoiceId)
  const meta = (inv.metadata ?? {}) as Record<string, string | undefined>
  if (meta.freeplug_kind !== ADDON_FIRST_PERIOD_KIND) return { outcome: 'not_addon' }
  if (inv.status !== 'paid') return { outcome: 'not_paid' }
  const addon = addonById(meta.addon)
  if (meta[ADDON_APPLIED_META]) return { outcome: 'already_applied', addon: addon?.id }
  const cents = inv.total ?? 0
  if (meta[ADDON_REFUNDED_META] || (inv.post_payment_credit_notes_amount ?? 0) >= cents) {
    const r = addonRefundOf(inv)
    const split = addonRefundSplit(inv.amount_paid ?? 0, cents)
    return { outcome: 'already_refunded', addon: addon?.id, refundReason: r?.reason ?? 'not_added', cardCents: r?.cardCents ?? split.cardCents, creditCents: r?.creditCents ?? split.creditCents }
  }

  // Every refund is logged with its reason; the reason code goes on the invoice for the customer's note.
  const refund = async (reason: string, code: AddonRefundReason): Promise<AddonHealResult> => {
    log(`[addon-heal] ${inv.id} (${meta.addon ?? '?'}, user ${meta.user_id || '?'}): ${reason}; refunding (reason ${code})`)
    const r = await refundAddonCharge(stripe, inv.id, inv.amount_paid ?? 0, cents, log, code)
    return { outcome: r.ok ? 'refunded' : 'refund_failed', reason, addon: addon?.id, refundReason: code, cardCents: r.cardCents, creditCents: r.creditCents }
  }
  if (!addon || !meta.subscription) return refund('unknown add-on or subscription', 'not_added')
  let sub: Sub
  try {
    sub = (await stripe.subscriptions.retrieve(meta.subscription)) as unknown as Sub
  } catch (e) {
    if (isMissingResource(e)) return refund('the subscription is gone', 'plan_ended')
    if (isRetryableStripeError(e)) return { outcome: 'retry', reason: errMsg(e), addon: addon.id }
    throw e
  }
  if (idOf(sub.customer ?? null) !== idOf(inv.customer as string | { id: string } | null)) return refund('the invoice and subscription customers differ', 'not_added')
  const existing = addonItemsOf(sub.items.data).find((i) => addonOfPrice(i.price)?.id === addon.id)
  if (existing) {
    await markAddonInvoice(stripe, inv.id, { [ADDON_APPLIED_META]: existing.id }, log)
    return { outcome: 'already_applied', addon: addon.id }
  }
  // Only inside the billing period it paid for (a replay after a renewal never adds it late).
  const start = subscriptionPeriodStart(sub as unknown as Stripe.Subscription)
  const paidAt = inv.status_transitions?.paid_at ?? inv.created
  if (start && paidAt * 1000 < start.getTime()) return refund('the billing period it paid for has ended', 'period_ended')
  const check = await addonChangeCheck(stripe, sub, addon.id, 'on', now)
  if (!check.ok) return refund(`it can't be added now (${check.code})`, refundReasonForRefusal(check.code))
  const confirmedTip = Number.parseInt(meta.tip_after ?? '', 10)
  if (check.tipMaxAfter < check.tipNow && check.tipMaxAfter !== confirmedTip) return refund('the tip drop it needs now was not confirmed', 'tip_unconfirmed')
  let priceId: string
  try {
    priceId = await deps.addonPriceIdFor(addon.id)
  } catch {
    return refund('the add-on price is not available', 'not_added')
  }
  try {
    await stripe.subscriptions.update(
      sub.id,
      { items: addonOnItems(sub, priceId, check.tipNow, check.tipMaxAfter), proration_behavior: 'none' },
      { idempotencyKey: `${meta.idempotency_key || `addon-heal:${inv.id}`}:heal` }
    )
  } catch (e) {
    if (isRetryableStripeError(e)) {
      log(`[addon-heal] ${inv.id}: update failed, will retry (${errMsg(e)})`)
      return { outcome: 'retry', reason: errMsg(e), addon: addon.id }
    }
    return refund(`the subscription update was refused (${errMsg(e)})`, 'not_added')
  }
  const fresh = await stripe.subscriptions.retrieve(sub.id)
  const added = addonItemsOf(fresh?.items?.data ?? []).find((i) => addonOfPrice(i.price)?.id === addon.id)
  if (!added) return refund('the add-on is not on the subscription after the update', 'not_added')
  await markAddonInvoice(stripe, inv.id, { [ADDON_APPLIED_META]: added.id }, log)
  log(`[addon-heal] ${inv.id}: ${addon.id} added to ${sub.id} (${added.id})`)
  return { outcome: 'applied', addon: addon.id }
}
