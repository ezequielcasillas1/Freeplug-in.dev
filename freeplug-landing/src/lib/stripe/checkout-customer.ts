import type Stripe from 'stripe'
import { createAdminClient } from '@/lib/supabase/admin'
import { DEFAULT_LOCALE, type AppLocale } from '@/i18n/config'
import { syncCustomerPreferredLocales } from '@/lib/stripe/locale'

/**
 * First-time buyer fix (Sep 25, 2026).
 *
 * Bug: the hosting checkout only ran the "one plan per customer" check when the profile already had
 * a stripe_customer_id. A first-time buyer (no id saved yet) skipped it entirely, and each Checkout
 * Session made with customer_email creates a brand-new Stripe customer. So a buyer could pay twice
 * from two tabs, or buy again right after paying while the webhook had not saved the customer id
 * yet (or never would: live webhooks can't be delivered while freeplug-in.dev doesn't resolve).
 *
 * Fix: before checkout, find every Stripe customer that could already hold this user's plan (the
 * saved id, else customers with the user's sign-in email) so the plan check always runs, and give a
 * first-time buyer one stable Stripe customer (created once per user, saved to the profile) so the
 * open-session race guard and the plan check work from the very first purchase.
 */

export type CheckoutUser = { id: string; email?: string | null }

/** Stripe customers whose subscriptions must be checked before selling a hosting plan. */
export async function findCustomersToCheck(
  stripe: Stripe,
  user: CheckoutUser,
  savedCustomerId: string | null
): Promise<{ customerIds: string[]; ownCustomerId: string | null }> {
  if (savedCustomerId) return { customerIds: [savedCustomerId], ownCustomerId: savedCustomerId }
  const email = user.email?.trim()
  if (!email) return { customerIds: [], ownCustomerId: null }
  const res = await stripe.customers.list({ email, limit: 10 })
  const customers = res.data.filter((c) => !(c as { deleted?: boolean }).deleted)
  const own = customers.find((c) => c.metadata?.supabase_user_id === user.id)
  return { customerIds: customers.map((c) => c.id), ownCustomerId: own?.id ?? null }
}

/**
 * Creates the user's Stripe customer (idempotent per user for 24h, so two tabs get the same one)
 * and saves it to profiles.stripe_customer_id when that is still empty. Saving is best effort: the
 * checkout webhook and the success-page sync write the same value later.
 */
export async function createCheckoutCustomer(
  stripe: Stripe,
  user: CheckoutUser,
  locale: AppLocale = DEFAULT_LOCALE
): Promise<string> {
  const customer = await stripe.customers.create(
    {
      ...(user.email ? { email: user.email } : {}),
      metadata: { supabase_user_id: user.id },
    },
    { idempotencyKey: `checkout-customer:${user.id}` }
  )
  await saveProfileCustomerId(user.id, customer.id)
  // Receipts and invoice emails in the customer's language (card R7). Set by update, not in the
  // idempotent create, so a language switch never collides with the create's idempotency key.
  await syncCustomerPreferredLocales(stripe, customer.id, locale)
  return customer.id
}

export async function saveProfileCustomerId(userId: string, customerId: string): Promise<void> {
  try {
    const { error } = await createAdminClient()
      .from('profiles')
      .update({ stripe_customer_id: customerId, updated_at: new Date().toISOString() })
      .eq('id', userId)
      .is('stripe_customer_id', null)
    if (error) console.error('[checkout/customer] profiles update', error)
  } catch (e) {
    console.error('[checkout/customer] could not save customer id', e instanceof Error ? e.message : e)
  }
}
