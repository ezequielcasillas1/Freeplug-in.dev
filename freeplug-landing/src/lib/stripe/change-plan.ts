import type Stripe from 'stripe'
// Relative import on purpose: scripts/stripe-test-setup-ladder.mjs loads this file (jiti) for the
// test-mode probes, outside Next's "@/" alias.
import { isPlanStepId, stepById, stepByLookupKey, type PlanStep, type PlanStepId } from '../plans/ladder'
import { PRORATION_DATE_MAX_AGE_SECONDS, planMove, type PlanMove } from '../plans/plan-direction'
import { subscriptionPeriodEnd } from './subscription-dates'
import { parseTipDollars, tierItems, tipItemOf, tipDollarsOfItems } from '../plans/tips'

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
 *             current items until current_period_end, phase 2 = the step price, then released).
 *             Nobody gets a mid-month credit; perks stay until the period ends.
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
 */

export type PendingPlanChange = { step: PlanStepId; effectiveAt: string; scheduleId: string }

export type ChangePlanResult =
  | { ok: true; kind: 'upgraded'; step: PlanStepId; invoiceStatus: string | null }
  | { ok: true; kind: 'scheduled'; step: PlanStepId; effectiveAt: string }
  | { ok: true; kind: 'unchanged'; step: PlanStepId }
  | { ok: false; code: 'payment_failed'; message: string; pendingRestored: boolean | null }
  | { ok: false; code: 'not_live' | 'ending' | 'price' | 'not_sellable' | 'stale_preview' | 'in_progress'; message: string }

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
    }
  | { ok: false; code: 'not_live' | 'ending' | 'not_upgrade' | 'not_sellable' | 'price'; message: string }

type Sub = Pick<Stripe.Subscription, 'id' | 'status' | 'cancel_at_period_end' | 'cancel_at' | 'schedule' | 'items'> & {
  latest_invoice?: string | { id: string } | null
}

/** What the PLAN costs a month (tier items only; a tip never counts). */
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

const idOf = (v: string | { id: string } | null | undefined) => (typeof v === 'string' ? v : (v?.id ?? null))
const scheduleId = (sub: Pick<Stripe.Subscription, 'schedule'>) => idOf(sub.schedule as string | { id: string } | null)

/**
 * The downgrade waiting in the subscription's schedule (the next phase, if it is one ladder price),
 * or null. Read-only: used by the Plans page ("Changing to X on <date>") and before releasing.
 */
export async function pendingPlanChange(
  stripe: Stripe,
  sub: Pick<Stripe.Subscription, 'schedule'>,
  now: Date = new Date()
): Promise<PendingPlanChange | null> {
  const id = scheduleId(sub)
  if (!id) return null
  const schedule = await stripe.subscriptionSchedules.retrieve(id)
  if (schedule.status && schedule.status !== 'active' && schedule.status !== 'not_started') return null
  const nowSec = Math.floor(now.getTime() / 1000)
  const next = schedule.phases.find((p) => p.start_date > nowSec)
  if (!next || next.items.length !== 1) return null
  let stepId: PlanStepId | null = isPlanStepId(next.metadata?.plan_step) ? next.metadata.plan_step : null
  if (!stepId) {
    const price = next.items[0].price
    const p = typeof price === 'string' ? await stripe.prices.retrieve(price) : (price as Stripe.Price)
    stepId = stepByLookupKey(p.lookup_key)?.id ?? null
  }
  return stepId ? { step: stepId, effectiveAt: new Date(next.start_date * 1000).toISOString(), scheduleId: schedule.id } : null
}

async function scheduleDowngrade(
  stripe: Stripe,
  subId: string,
  existingScheduleId: string | null,
  priceId: string,
  target: PlanStepId
): Promise<string> {
  const schedule = existingScheduleId
    ? await stripe.subscriptionSchedules.retrieve(existingScheduleId)
    : await stripe.subscriptionSchedules.create({ from_subscription: subId })
  const phase = schedule.current_phase ?? schedule.phases[0]
  const start = 'start_date' in phase ? phase.start_date : schedule.phases[0].start_date
  const end = 'end_date' in phase ? phase.end_date : schedule.phases[0].end_date
  const currentItems = schedule.phases[0].items.map((i) => ({
    price: typeof i.price === 'string' ? i.price : i.price.id,
    quantity: i.quantity ?? 1,
  }))
  await stripe.subscriptionSchedules.update(schedule.id, {
    end_behavior: 'release',
    phases: [
      { items: currentItems, start_date: start, end_date: end, proration_behavior: 'none' },
      {
        items: [{ price: priceId, quantity: 1 }],
        proration_behavior: 'none',
        duration: { interval: 'month', interval_count: 1 },
        metadata: { plan_step: target },
      },
    ],
  })
  return new Date(end * 1000).toISOString()
}

const isCardError = (e: unknown) =>
  !!e && typeof e === 'object' && ((e as { type?: string }).type === 'StripeCardError' || (e as { code?: string }).code === 'card_declined')

const PAYMENT_FAILED = 'The card was not charged, so the plan did not change.'

/** Stripe's 409 for a second request with the same idempotency key while the first is in flight. */
const isKeyInUse = (e: unknown) => !!e && typeof e === 'object' && (e as { code?: string }).code === 'idempotency_key_in_use'

/**
 * Items for an upgrade: the TIER item (the ladder price, else a legacy plan's first non-tip item)
 * becomes the step price; every other item goes, an old add-on AND the tip (a plan change resets
 * the tip to $0). Exported for tests.
 */
export function upgradeItems(sub: Pick<Stripe.Subscription, 'items'>, priceId: string): Stripe.SubscriptionUpdateParams.Item[] {
  const tier = tierItems(sub.items.data)
  const keep = tier.find((i) => stepByLookupKey(i.price.lookup_key)) ?? tier[0] ?? sub.items.data[0]
  const rest = sub.items.data.filter((i) => i.id !== keep.id)
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
  let priceId: string
  try {
    priceId = await deps.priceIdFor(target.id)
  } catch {
    return { ok: false, code: 'price', message: 'This plan is not available right now.' }
  }
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
    nextAmountCents: target.monthlyCents,
    nextBillingAt: end ? end.toISOString() : null,
    tipDollars: subscriptionTipDollars(sub),
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
  const pending = scheduleId(sub)

  if (move === 'same') {
    if (pending) await stripe.subscriptionSchedules.release(pending)
    return { ok: true, kind: 'unchanged', step: target.id }
  }
  if (!target.sellable) {
    return { ok: false, code: 'not_sellable', message: `${target.name} is not sold yet.` }
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
    // Release a pending downgrade first (Aria, Oct 3 12:25). Remember it so a failed card puts it back.
    let restore: PendingPlanChange | null = null
    if (pending) {
      restore = await pendingPlanChange(stripe, sub, deps.now?.()).catch(() => null)
      await stripe.subscriptionSchedules.release(pending)
    }
    const putBack = async (): Promise<boolean | null> => {
      if (!restore) return null
      try {
        await scheduleDowngrade(stripe, sub.id, null, await deps.priceIdFor(restore.step), restore.step)
        return true
      } catch (e) {
        log(`[change-plan] could not restore the pending downgrade on ${sub.id}: ${e instanceof Error ? e.message : String(e)}`)
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
    return { ok: true, kind: 'upgraded', step: target.id, invoiceStatus: inv && typeof inv !== 'string' ? (inv.status ?? null) : null }
  }

  // downgrade at period end
  const effectiveAt = await scheduleDowngrade(stripe, sub.id, pending, priceId, target.id)
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
  const pending = scheduleId(sub)
  let cleared: PendingPlanChange | null = null
  if (pending) {
    cleared = await pendingPlanChange(stripe, sub, now).catch(() => null)
    await stripe.subscriptionSchedules.release(pending)
  }
  await stripe.subscriptions.update(sub.id, { cancel_at_period_end: true }, { idempotencyKey: `plan-cancel:${sub.id}:${pending ?? 'none'}` })
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
async function tipChangeItems(sub: Sub, tipDollars: unknown, tipPriceId: () => Promise<string>): Promise<TipCheck> {
  if (sub.status !== 'active' && sub.status !== 'trialing') return { ok: false, code: 'not_live', message: 'No active hosting plan.' }
  if (sub.cancel_at_period_end || sub.cancel_at) return { ok: false, code: 'ending', message: 'This plan is set to end.' }
  // A planned switch drops the tip at the switch date; changing it now would be overwritten by the
  // schedule's next phase, so it waits until the switch has happened (or "Keep <plan>" cancels it).
  if (scheduleId(sub)) return { ok: false, code: 'pending_change', message: 'A plan switch is planned.' }
  const step = currentLadderStep(sub)
  if (!step) return { ok: false, code: 'no_tip_plan', message: 'Tips are for hosting ladder plans.' }
  const parsed = parseTipDollars(step, tipDollars)
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
  tipDollars: unknown
): Promise<TipChangePreview> {
  const check = await tipChangeItems(sub, tipDollars, deps.tipPriceId)
  if (!check.ok) return check
  const next = typeof tipDollars === 'number' ? tipDollars : 0
  const end = subscriptionPeriodEnd(sub as Stripe.Subscription)
  const computed = check.step.monthlyCents + next * 100
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
  const check = await tipChangeItems(sub, tipDollars, deps.tipPriceId)
  if (!check.ok) return check
  const next = typeof tipDollars === 'number' ? tipDollars : 0
  const end = subscriptionPeriodEnd(sub as Stripe.Subscription)
  const nextBillingAt = end ? end.toISOString() : null
  const nextAmountCents = check.step.monthlyCents + next * 100
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
