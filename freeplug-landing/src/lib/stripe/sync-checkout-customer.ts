import type Stripe from 'stripe'
import { getStripe } from '@/lib/stripe/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { supabasePlanStepStore, syncPlanStepForCustomer } from '@/lib/plans/plan-step-sync'

/** Stripe Checkout Session ids look like cs_test_… / cs_live_…; reject anything else before calling Stripe. */
const CHECKOUT_SESSION_ID_RE = /^cs_(test|live)_[A-Za-z0-9]{1,250}$/

function getCustomerId(
  customer: string | Stripe.Customer | Stripe.DeletedCustomer | null
): string | null {
  if (!customer) return null
  return typeof customer === 'string' ? customer : customer.id
}

/**
 * Fallback for the Stripe webhook: when the signed-in user lands on the checkout
 * success_url (?session_id={CHECKOUT_SESSION_ID}), retrieve the session server-side
 * and save its customer id to profiles.stripe_customer_id.
 *
 * Only the session id comes from the client. The session must be complete and its
 * metadata.supabase_user_id must match the signed-in user. Idempotent: it only fills
 * an empty stripe_customer_id (the same value the webhook would write) and never
 * overwrites an existing one. Never throws; failures are logged and ignored.
 */
export async function syncStripeCustomerFromCheckoutSession(
  sessionId: unknown,
  userId: string
): Promise<void> {
  try {
    if (typeof sessionId !== 'string' || !CHECKOUT_SESSION_ID_RE.test(sessionId)) return

    const session = await getStripe().checkout.sessions.retrieve(sessionId)
    if (session.status !== 'complete') return
    if (session.metadata?.supabase_user_id !== userId) return

    const customerId = getCustomerId(session.customer)
    if (!customerId) return

    const admin = createAdminClient()
    const { error } = await admin
      .from('profiles')
      .update({
        stripe_customer_id: customerId,
        updated_at: new Date().toISOString(),
      })
      .eq('id', userId)
      .is('stripe_customer_id', null)

    if (error) {
      console.error('[checkout/success] profiles update', error)
    }
  } catch (e) {
    console.error('[checkout/success] session sync failed', e instanceof Error ? e.message : e)
  }
}

/**
 * Fallback for the webhook before an in-app plan move (Aria, Oct 3 12:25): a profile that was never
 * synced gets its plan snapshot from Stripe first (the same columns the customer.subscription.*
 * webhook writes), so the move itself only reaches perks through the webhook. Throws on failure;
 * the caller then refuses the move.
 */
export async function syncPlanSnapshotForCustomer(stripe: Stripe, customerId: string) {
  return syncPlanStepForCustomer(
    { stripe, store: supabasePlanStepStore(createAdminClient() as unknown as Parameters<typeof supabasePlanStepStore>[0]) },
    customerId
  )
}
