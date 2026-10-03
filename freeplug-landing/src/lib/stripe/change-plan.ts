import type Stripe from 'stripe'
// Relative import on purpose: scripts/stripe-test-setup-ladder.mjs loads this file (jiti) for the
// test-mode probes, outside Next's "@/" alias.
import { stepById, stepByLookupKey, type PlanStep, type PlanStepId } from '../plans/ladder'

/**
 * Moving a live hosting subscription to a ladder step (Aria section 6.4). Done in the app, not the
 * Billing Portal: Stripe's portal can only schedule a period-end downgrade between prices of the
 * same product, and a product can't hold two monthly prices in a portal configuration (checked in
 * test mode, Oct 3), so the portal can't give a monthly ladder "downgrades at period end".
 *
 *   upgrade   (step price > what the subscription costs now): immediate. Items are replaced by
 *             the step price, proration_behavior=always_invoice (time-based difference charged
 *             now), payment_behavior=pending_if_incomplete (if the card fails, Stripe keeps the
 *             old plan; nothing half-changes).
 *   downgrade (step price < now): at period end, through a subscription schedule (phase 1 = the
 *             current items until current_period_end, phase 2 = the step price, then released).
 *             Nobody gets a mid-month credit; perks stay until the period ends.
 *   same step: nothing changes (a pending downgrade is cancelled).
 *
 * Grandfathered plans move only when the customer picks a step (never automatically). Their
 * "now" amount is the subscription's monthly total (hosting + add-on); an equal-priced step is
 * treated as an upgrade (applied now, zero proration).
 */
export type PlanMove = 'upgrade' | 'downgrade' | 'same'

export type ChangePlanResult =
  | { ok: true; kind: 'upgraded'; step: PlanStepId; invoiceStatus: string | null }
  | { ok: true; kind: 'scheduled'; step: PlanStepId; effectiveAt: string }
  | { ok: true; kind: 'unchanged'; step: PlanStepId }
  | { ok: false; code: 'not_live' | 'ending' | 'price' | 'payment_failed'; message: string }

type Sub = Pick<Stripe.Subscription, 'id' | 'status' | 'cancel_at_period_end' | 'cancel_at' | 'schedule' | 'items'>

export function subscriptionMonthlyCents(sub: Pick<Stripe.Subscription, 'items'>): number {
  return sub.items.data.reduce((sum, item) => {
    const amount = (item.price.unit_amount ?? 0) * (item.quantity ?? 1)
    return sum + (item.price.recurring?.interval === 'year' ? Math.round(amount / 12) : amount)
  }, 0)
}

/** The ladder step a subscription is on (by price lookup key), or null for a grandfathered plan. */
export function currentLadderStep(sub: Pick<Stripe.Subscription, 'items'>): PlanStep | null {
  if (sub.items.data.length !== 1) return null
  return stepByLookupKey(sub.items.data[0].price.lookup_key)
}

export function planMove(current: PlanStep | null, currentCents: number, target: PlanStep): PlanMove {
  if (current && current.id === target.id) return 'same'
  if (target.monthlyCents > currentCents) return 'upgrade'
  if (target.monthlyCents === currentCents) return current ? 'same' : 'upgrade'
  return 'downgrade'
}

const scheduleId = (sub: Sub) => (typeof sub.schedule === 'string' ? sub.schedule : (sub.schedule?.id ?? null))

export async function changePlanStep(
  deps: { stripe: Stripe; priceIdFor: (id: PlanStepId) => Promise<string>; now?: () => Date },
  sub: Sub,
  targetId: PlanStepId
): Promise<ChangePlanResult> {
  const { stripe } = deps
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

  let priceId: string
  try {
    priceId = await deps.priceIdFor(target.id)
  } catch {
    return { ok: false, code: 'price', message: 'This plan is not available right now.' }
  }

  if (move === 'upgrade') {
    if (pending) await stripe.subscriptionSchedules.release(pending)
    const [first, ...rest] = sub.items.data
    const items: Stripe.SubscriptionUpdateParams.Item[] = [
      { id: first.id, price: priceId, quantity: 1 },
      ...rest.map((i) => ({ id: i.id, deleted: true as const })),
    ]
    const updated = await stripe.subscriptions.update(
      sub.id,
      { items, proration_behavior: 'always_invoice', payment_behavior: 'pending_if_incomplete', expand: ['latest_invoice'] },
      { idempotencyKey: `plan-move:${sub.id}:${sub.items.data.map((i) => i.price.id).join('+')}:${target.id}` }
    )
    if (updated.pending_update) {
      return { ok: false, code: 'payment_failed', message: 'The card was not charged, so the plan did not change.' }
    }
    const inv = updated.latest_invoice
    return { ok: true, kind: 'upgraded', step: target.id, invoiceStatus: inv && typeof inv !== 'string' ? (inv.status ?? null) : null }
  }

  // downgrade at period end
  const schedule = pending
    ? await stripe.subscriptionSchedules.retrieve(pending)
    : await stripe.subscriptionSchedules.create({ from_subscription: sub.id })
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
        metadata: { plan_step: target.id },
      },
    ],
  })
  return { ok: true, kind: 'scheduled', step: target.id, effectiveAt: new Date(end * 1000).toISOString() }
}
