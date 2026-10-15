import type Stripe from 'stripe'
import { PLAN_STEPS, resolvePlanStep, stepByLookupKey, type PlanStep } from '../plans/ladder'

/**
 * When a step's `sellable` flag turns off (ladder.ts), its OPEN Checkout Sessions must not be paid
 * any more (Aria, Oct 3 12:56): expire them through the API. Idempotent: only sessions still open
 * are touched, and a session that closed in the meantime (paid, expired) is reported, not an error.
 * Run from Admin > Customers ("Expire open checkouts for steps not sold") or the test-mode script
 * (scripts/stripe-test-setup-ladder.mjs --probe-checkout-expiry).
 *
 * A session's step: metadata.plan_step (set by /api/checkout/hosting), else the lookup key of its
 * line item's price. Sessions that are not for a ladder step (maintenance payments, the outreach
 * claim's setup-mode card save, legacy add-ons) are left alone.
 */
export type ExpireUnsellableReport = {
  checked: number
  expired: { id: string; step: string }[]
  alreadyClosed: { id: string; step: string; status: string | null }[]
  kept: number
}

type StripeLike = {
  checkout: {
    sessions: Pick<Stripe['checkout']['sessions'], 'list' | 'listLineItems' | 'expire' | 'retrieve'>
  }
}

export async function stepOfCheckoutSession(
  stripe: StripeLike,
  s: Pick<Stripe.Checkout.Session, 'id' | 'mode' | 'metadata'>,
  steps: readonly PlanStep[] = PLAN_STEPS
): Promise<PlanStep | null> {
  if (s.mode !== 'subscription') return null
  const byMeta = resolvePlanStep(s.metadata?.plan_step ?? null)
  if (byMeta) return steps.find((x) => x.id === byMeta.id) ?? null
  const items = await stripe.checkout.sessions.listLineItems(s.id, { limit: 10 })
  for (const li of items.data) {
    const found = stepByLookupKey(li.price?.lookup_key ?? null)
    if (found) return steps.find((x) => x.id === found.id) ?? null
  }
  return null
}

export async function expireUnsellableCheckoutSessions(
  stripe: StripeLike,
  {
    steps = PLAN_STEPS,
    log = (m: string) => console.info(m),
    customer,
  }: {
    steps?: readonly PlanStep[]
    log?: (m: string) => void
    /** Only this Stripe customer's sessions (the test-mode probe); default: every open session. */
    customer?: string
  } = {}
): Promise<ExpireUnsellableReport> {
  const report: ExpireUnsellableReport = { checked: 0, expired: [], alreadyClosed: [], kept: 0 }
  let startingAfter: string | undefined
  for (let page = 0; page < 50; page++) {
    const res = await stripe.checkout.sessions.list({
      status: 'open',
      limit: 100,
      ...(customer ? { customer } : {}),
      ...(startingAfter ? { starting_after: startingAfter } : {}),
    })
    for (const s of res.data) {
      report.checked++
      const step = await stepOfCheckoutSession(stripe, s, steps)
      if (!step || step.sellable) {
        report.kept++
        continue
      }
      try {
        await stripe.checkout.sessions.expire(s.id)
        report.expired.push({ id: s.id, step: step.id })
        log(`[checkout-expiry] expired ${s.id} (${step.id}, not sellable)`)
      } catch (e) {
        const now = await stripe.checkout.sessions.retrieve(s.id).catch(() => null)
        if (now && now.status !== 'open') {
          report.alreadyClosed.push({ id: s.id, step: step.id, status: now.status ?? null })
          continue
        }
        throw e
      }
    }
    if (!res.has_more || res.data.length === 0) break
    startingAfter = res.data[res.data.length - 1].id
  }
  return report
}
