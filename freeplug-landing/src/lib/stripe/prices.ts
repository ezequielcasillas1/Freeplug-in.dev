import type Stripe from 'stripe'
import { PLAN_STEPS, stepById, type PlanStepId } from '@/lib/plans/ladder'
import { getStripe } from '@/lib/stripe/server'

/**
 * Stripe price lookup for the hosting ladder: every new hosting checkout and outreach publish
 * charges the Price behind the step's lookup key (freeplug_step_<id>_monthly). Nothing builds an
 * inline price any more. Prices are created by scripts/stripe-test-setup-ladder.mjs (test mode);
 * live prices wait for Ezequiel.
 *
 * Fail closed: a missing, inactive or mismatched price (wrong product, amount, currency or interval compared
 * with ladder.ts) throws PriceNotConfiguredError, which callers turn into a 503. Nobody is charged
 * an amount that differs from the config.
 */
export class PriceNotConfiguredError extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'PriceNotConfiguredError'
  }
}

type CacheEntry = { ids: Map<PlanStepId, string>; at: number }
const TTL_MS = 10 * 60 * 1000
let cache: CacheEntry | null = null

/** Test hook. */
export function resetStepPriceCache(): void {
  cache = null
}

function validates(price: Stripe.Price, stepId: PlanStepId): boolean {
  const step = stepById(stepId)
  const product = typeof price.product === 'string' ? price.product : price.product?.id
  return (
    price.active === true &&
    product === step.productId &&
    price.currency === 'usd' &&
    price.unit_amount === step.monthlyCents &&
    price.type === 'recurring' &&
    price.recurring?.interval === 'month' &&
    (price.recurring?.interval_count ?? 1) === 1
  )
}

async function loadAll(stripe: Stripe): Promise<Map<PlanStepId, string>> {
  const res = await stripe.prices.list({
    lookup_keys: PLAN_STEPS.map((s) => s.lookupKey),
    active: true,
    limit: 100,
  })
  const ids = new Map<PlanStepId, string>()
  for (const step of PLAN_STEPS) {
    const price = res.data.find((p) => p.lookup_key === step.lookupKey)
    if (price && validates(price, step.id)) ids.set(step.id, price.id)
  }
  return ids
}

/** Price id for a step, cached per isolate (10 min). Throws PriceNotConfiguredError when missing. */
export async function getStepPriceId(stepId: PlanStepId, stripe: Stripe = getStripe(), now = Date.now()): Promise<string> {
  if (!cache || now - cache.at > TTL_MS || !cache.ids.has(stepId)) {
    cache = { ids: await loadAll(stripe), at: now }
  }
  const id = cache.ids.get(stepId)
  if (!id) {
    throw new PriceNotConfiguredError(
      `No active monthly USD price with lookup key ${stepById(stepId).lookupKey} matching the ladder amount.`
    )
  }
  return id
}
