import type Stripe from 'stripe'
import { PLAN_STEPS, resolvePlanStep, type PlanStep } from './ladder'

/**
 * A completed hosting Checkout for a step that is no longer sellable (Aria, Oct 3 12:56): the
 * customer paid, so we HONOR it (nothing is canceled or refunded here; the subscription webhook
 * records the step as usual) and flag it for admin review in public.plan_unsold_purchases
 * (migration 20261003190000), shown as a badge on Admin > Customers.
 *
 * The step comes from the session's metadata.plan_step, which /api/checkout/hosting always sets.
 */
export type UnsoldPurchaseRow = {
  checkout_session_id: string
  user_id: string | null
  stripe_customer_id: string | null
  stripe_subscription_id: string | null
  plan_step: string
}

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
const idOf = (v: string | { id: string } | null | undefined) => (v == null ? null : typeof v === 'string' ? v : v.id)

export function unsoldPurchaseFromSession(
  session: Pick<Stripe.Checkout.Session, 'id' | 'mode' | 'status' | 'metadata' | 'customer' | 'subscription'>,
  steps: readonly PlanStep[] = PLAN_STEPS
): UnsoldPurchaseRow | null {
  if (session.mode !== 'subscription' || session.status !== 'complete') return null
  const resolved = resolvePlanStep(session.metadata?.plan_step ?? null)
  const step = resolved ? steps.find((s) => s.id === resolved.id) : undefined
  if (!step || step.sellable) return null
  const uid = session.metadata?.supabase_user_id
  return {
    checkout_session_id: session.id,
    user_id: uid && UUID_RE.test(uid) ? uid : null,
    stripe_customer_id: idOf(session.customer as string | { id: string } | null),
    stripe_subscription_id: idOf(session.subscription as string | { id: string } | null),
    plan_step: step.id,
  }
}

export type UnsoldPurchaseStore = { record(row: UnsoldPurchaseRow): Promise<void> }

/** Service-role store (the webhook passes its admin client). One row per session: retries are no-ops. */
export function supabaseUnsoldPurchaseStore(admin: {
  from: (t: string) => {
    upsert: (row: UnsoldPurchaseRow, opts: { onConflict: string; ignoreDuplicates: boolean }) => PromiseLike<{ error: { message: string } | null }>
  }
}): UnsoldPurchaseStore {
  return {
    async record(row) {
      const { error } = await admin.from('plan_unsold_purchases').upsert(row, { onConflict: 'checkout_session_id', ignoreDuplicates: true })
      if (error) throw new Error(`plan_unsold_purchases: ${error.message}`)
    },
  }
}

/** Webhook step: flag (never cancel) a completed session for a step that is not sold. */
export async function flagUnsoldPurchase(
  store: UnsoldPurchaseStore,
  session: Parameters<typeof unsoldPurchaseFromSession>[0],
  steps: readonly PlanStep[] = PLAN_STEPS
): Promise<UnsoldPurchaseRow | null> {
  const row = unsoldPurchaseFromSession(session, steps)
  if (row) await store.record(row)
  return row
}
