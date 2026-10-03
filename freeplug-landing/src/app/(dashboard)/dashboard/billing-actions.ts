'use server'

import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { appBaseUrl } from '@/lib/stripe/config'
import { getStripe } from '@/lib/stripe/server'
import { resumeEndingSubscriptions } from '@/lib/stripe/resume-hosting'

export async function openBillingPortal() {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) {
    redirect('/login?next=/dashboard')
  }

  const { data: prof } = await supabase
    .from('profiles')
    .select('stripe_customer_id')
    .eq('id', user.id)
    .single()

  const customerId = prof?.stripe_customer_id
  if (!customerId) {
    return
  }

  const stripe = getStripe()
  const session = await stripe.billingPortal.sessions.create({
    customer: customerId,
    return_url: `${appBaseUrl()}/dashboard`,
  })

  if (session.url) {
    redirect(session.url)
  }
}

/**
 * Dashboard "Resume plan" (shown while hosting is canceled but the paid period is still running):
 * undo the scheduled cancellation on the existing subscription, so there is no second plan and no
 * new charge. If nothing could be resumed here, fall back to the Stripe billing portal.
 * (When hosting has already ended, the dashboard shows "Restart hosting", which goes to checkout.)
 */
export async function resumePlan() {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) {
    redirect('/login?next=/dashboard')
  }

  const { data: prof } = await supabase
    .from('profiles')
    .select('stripe_customer_id')
    .eq('id', user.id)
    .single()

  const customerId = prof?.stripe_customer_id
  let resumed = 0
  if (customerId) {
    try {
      resumed = await resumeEndingSubscriptions(getStripe(), customerId)
    } catch (e) {
      console.error('[resumePlan] resume failed', e instanceof Error ? e.message : e)
    }
  }
  if (resumed > 0) {
    redirect('/dashboard?hosting=resumed')
  }
  await openBillingPortal()
  redirect('/dashboard')
}
