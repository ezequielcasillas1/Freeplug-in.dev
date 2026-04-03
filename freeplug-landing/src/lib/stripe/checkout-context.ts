import type Stripe from 'stripe'
import { createClient } from '@/lib/supabase/server'
import { ensureProfile } from '@/lib/supabase/ensure-profile'
import { appBaseUrl } from '@/lib/stripe/config'

export type CheckoutPaths = {
  base: string
  successPath: string
  cancelPath: string
}

/** Paths and Stripe customer options when the caller is (or is not) signed in. */
export async function getCheckoutSessionContext(): Promise<{
  paths: CheckoutPaths
  user: { id: string; email?: string | null } | null
  stripeCustomerId: string | null
}> {
  const base = appBaseUrl()
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    return {
      paths: { base, successPath: '/', cancelPath: '/' },
      user: null,
      stripeCustomerId: null,
    }
  }

  await ensureProfile(user.id)
  const { data: prof } = await supabase
    .from('profiles')
    .select('stripe_customer_id')
    .eq('id', user.id)
    .single()

  return {
    paths: { base, successPath: '/dashboard', cancelPath: '/dashboard' },
    user,
    stripeCustomerId: prof?.stripe_customer_id ?? null,
  }
}

/** Attach logged-in user metadata and Stripe customer when available. */
export function applyUserToCheckoutSession(
  params: Stripe.Checkout.SessionCreateParams,
  ctx: Awaited<ReturnType<typeof getCheckoutSessionContext>>,
  metadata: Record<string, string>
): Stripe.Checkout.SessionCreateParams {
  const { paths, user, stripeCustomerId } = ctx
  const merged: Stripe.Checkout.SessionCreateParams = {
    ...params,
    success_url: `${paths.base}${paths.successPath}?checkout=success&session_id={CHECKOUT_SESSION_ID}`,
    cancel_url: `${paths.base}${paths.cancelPath}?checkout=cancelled`,
    metadata: user
      ? { ...metadata, supabase_user_id: user.id }
      : metadata,
  }

  if (!user) return merged

  if (stripeCustomerId) {
    merged.customer = stripeCustomerId
  } else if (user.email) {
    merged.customer_email = user.email
    // Stripe: customer_creation is only allowed for payment mode, not subscription.
    if (params.mode === 'payment') {
      merged.customer_creation = 'always'
    }
  }

  return merged
}
