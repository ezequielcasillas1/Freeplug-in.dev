import type Stripe from 'stripe'
import { isLiveSubscriptionStatus } from '@/lib/stripe/active-subscription'
import type { PlanStepId } from '@/lib/plans/ladder'
import { getStepPriceId } from '@/lib/stripe/prices'
import { resolveLegacyOutreachPlan, resolveOutreachStep } from './plan'

/**
 * Outreach billing (Stripe option (a), Aria section 9). No database or env access here: the
 * service-role store is injected by src/lib/outreach/server.ts, and tests pass fakes.
 *
 *   * Setup-mode Checkout saves the card at claim; the webhook (or the verified return URL) calls
 *     completeSetupSession(). Nothing is charged.
 *   * Admin Publish calls publishOutreachSite(): the step is re-resolved on the server and charged
 *     through the Stripe price behind its lookup key (hosting ladder, Oct 3 2026), the
 *     subscription is created off-session with an idempotency key per site + attempt, and the
 *     site goes live only when the first invoice is paid (subscription status 'active').
 *     A declined card or 3D Secure leaves it unpublished with the reason for admin.
 */

export type OutreachBillingSite = {
  id: string
  business_name: string
  claimed_by: string | null
  /** Hosting-ladder step chosen at claim step 3 (required for new claims). */
  plan_step: string | null
  /** Pre-ladder choice (read-only; never charged). */
  plan_hosting_cents: number | null
  plan_addon_tier: string | null
  setup_session_id: string | null
  setup_completed_at: string | null
  stripe_customer_id: string | null
  stripe_payment_method_id: string | null
  stripe_subscription_id: string | null
  publish_status: 'none' | 'processing' | 'failed' | 'live'
  publish_attempts: number
  live_url: string | null
}

export type OutreachSitePatch = Partial<{
  setup_completed_at: string
  stripe_customer_id: string
  stripe_payment_method_id: string
  stripe_subscription_id: string | null
  publish_status: 'none' | 'processing' | 'failed' | 'live'
  publish_error: string | null
  publish_attempts: number
  published_at: string | null
  live_url: string | null
  claimer_verified_at: string
}>

export interface OutreachBillingStore {
  getSite(id: string): Promise<OutreachBillingSite | null>
  getSiteBySetupSession(sessionId: string): Promise<OutreachBillingSite | null>
  getSiteBySubscription(subscriptionId: string): Promise<OutreachBillingSite | null>
  /** Atomic none|failed -> processing; false when another publish is already running or done. */
  beginPublish(id: string): Promise<boolean>
  updateSite(id: string, patch: OutreachSitePatch): Promise<void>
  setProfileCustomer(userId: string, customerId: string): Promise<void>
}

export type BillingDeps = {
  stripe: Stripe
  store: OutreachBillingStore
  now?: () => Date
  /** Price id for a step; defaults to the lookup-key resolver in lib/stripe/prices.ts. */
  stepPriceId?: (stepId: PlanStepId) => Promise<string>
}

/** Admin-only message (not customer copy): publish refused for a step that is not sold yet. */
export const STEP_NOT_SELLABLE_PUBLISH_ERROR = (name: string) =>
  `${name} is not sold yet (ladder.ts sellable=false). Ask the customer to pick another plan on the claim page.`

/** Shown to admins when a site still has a pre-ladder (slider/add-on) choice. */
export const LEGACY_PLAN_PUBLISH_ERROR =
  'This site has an old hosting choice (from before the plan ladder). Ask the customer to choose a plan again. Nothing was charged.'

function idOf(v: string | { id: string } | null | undefined): string | null {
  if (!v) return null
  return typeof v === 'string' ? v : v.id
}

// ------------------------------------------------------------------ setup (card saved)

export type SetupResult =
  | { handled: false }
  | { handled: true; outcome: 'saved' | 'already_saved' | 'ignored'; siteId?: string }

export async function completeSetupSession(
  deps: BillingDeps,
  session: Stripe.Checkout.Session
): Promise<SetupResult> {
  if (session.mode !== 'setup') return { handled: false }
  const md = session.metadata ?? {}
  if (md.type !== 'outreach_setup' || session.status !== 'complete') {
    return { handled: true, outcome: 'ignored' }
  }
  const site = await deps.store.getSiteBySetupSession(session.id)
  // The site is found by the session id we stored, and must match the metadata and the claimer.
  if (!site || site.id !== md.outreach_site_id || !site.claimed_by || site.claimed_by !== md.supabase_user_id) {
    return { handled: true, outcome: 'ignored' }
  }
  if (site.setup_completed_at) return { handled: true, outcome: 'already_saved', siteId: site.id }

  const customerId = idOf(session.customer as string | { id: string } | null)
  let setupIntent = session.setup_intent as string | Stripe.SetupIntent | null
  if (typeof setupIntent === 'string') setupIntent = await deps.stripe.setupIntents.retrieve(setupIntent)
  const paymentMethodId = idOf(setupIntent?.payment_method as string | { id: string } | null)
  if (!customerId || !paymentMethodId || setupIntent?.status !== 'succeeded') {
    return { handled: true, outcome: 'ignored' }
  }

  await deps.stripe.customers.update(customerId, {
    invoice_settings: { default_payment_method: paymentMethodId },
  })
  await deps.store.updateSite(site.id, {
    setup_completed_at: (deps.now?.() ?? new Date()).toISOString(),
    stripe_customer_id: customerId,
    stripe_payment_method_id: paymentMethodId,
  })
  await deps.store.setProfileCustomer(site.claimed_by, customerId)
  return { handled: true, outcome: 'saved', siteId: site.id }
}

// ------------------------------------------------------------------ publish (subscription starts)

export type PublishResult =
  | { ok: true; status: 'live'; already?: boolean; subscriptionId: string | null }
  | { ok: false; status: 'failed' | 'refused'; error: string }

function failureMessage(sub: Stripe.Subscription): string {
  const inv = sub.latest_invoice && typeof sub.latest_invoice !== 'string' ? sub.latest_invoice : null
  const link = inv?.hosted_invoice_url ? ` Send the customer this payment link: ${inv.hosted_invoice_url}` : ''
  return `Card failed or needs 3D Secure (subscription ${sub.status}). The site stays unpublished.${link}`
}

export async function publishOutreachSite(
  deps: BillingDeps,
  siteId: string,
  opts: { claimerVerified: boolean; liveUrl?: string | null }
): Promise<PublishResult> {
  const { stripe, store } = deps
  const now = () => (deps.now?.() ?? new Date()).toISOString()
  const site = await store.getSite(siteId)
  if (!site) return { ok: false, status: 'refused', error: 'Site not found.' }
  if (site.publish_status === 'live') {
    return { ok: true, status: 'live', already: true, subscriptionId: site.stripe_subscription_id }
  }
  if (!opts.claimerVerified) {
    return { ok: false, status: 'refused', error: 'Check "Claimer verified as the business" first.' }
  }
  if (!site.claimed_by) return { ok: false, status: 'refused', error: 'Nobody has claimed this site yet.' }
  if (!site.setup_completed_at || !site.stripe_customer_id || !site.stripe_payment_method_id) {
    return { ok: false, status: 'refused', error: "The customer hasn't saved a card yet." }
  }
  const step = resolveOutreachStep(site.plan_step)
  if (!step) {
    if (resolveLegacyOutreachPlan(site.plan_hosting_cents, site.plan_addon_tier ?? 'none')) {
      return { ok: false, status: 'refused', error: LEGACY_PLAN_PUBLISH_ERROR }
    }
    return { ok: false, status: 'refused', error: 'No valid hosting plan is saved for this site.' }
  }
  // Publish starts a NEW subscription, so a step that is not sold (ladder.ts sellable=false) is
  // refused here even if it was saved earlier. The customer can pick another step on the claim page.
  if (!step.sellable) {
    return { ok: false, status: 'refused', error: STEP_NOT_SELLABLE_PUBLISH_ERROR(step.name) }
  }

  if (!(await store.beginPublish(site.id))) {
    return { ok: false, status: 'refused', error: 'Publish is already running for this site.' }
  }

  const liveUrl = opts.liveUrl?.trim() || site.live_url || null
  const goLive = async (subId: string): Promise<PublishResult> => {
    await store.updateSite(site.id, {
      publish_status: 'live',
      published_at: now(),
      publish_error: null,
      stripe_subscription_id: subId,
      live_url: liveUrl,
      claimer_verified_at: now(),
    })
    return { ok: true, status: 'live', subscriptionId: subId }
  }
  const fail = async (error: string, patch: OutreachSitePatch = {}): Promise<PublishResult> => {
    await store.updateSite(site.id, { publish_status: 'failed', publish_error: error, claimer_verified_at: now(), ...patch })
    return { ok: false, status: 'failed', error }
  }

  try {
    const customer = site.stripe_customer_id
    const paymentMethod = site.stripe_payment_method_id
    let attempt = site.publish_attempts

    // Retry path: an earlier attempt left an unpaid (incomplete) subscription. Pay that invoice
    // instead of creating a second subscription.
    if (site.stripe_subscription_id) {
      const prev = await stripe.subscriptions.retrieve(site.stripe_subscription_id, {
        expand: ['latest_invoice'],
      })
      if (prev.status === 'active') return await goLive(prev.id)
      if (prev.status === 'incomplete') {
        const invId = idOf(prev.latest_invoice as string | { id: string } | null)
        if (invId) {
          try {
            await stripe.invoices.pay(invId, { off_session: true, payment_method: paymentMethod })
          } catch {
            /* the status check below reports it */
          }
        }
        const after = await stripe.subscriptions.retrieve(prev.id, { expand: ['latest_invoice'] })
        if (after.status === 'active') return await goLive(after.id)
        return await fail(failureMessage(after), { stripe_subscription_id: after.id })
      }
      // incomplete_expired / canceled: start a fresh attempt below.
      attempt += 1
    }

    // One plan per customer: refuse if the customer already has another live subscription.
    const existing = await stripe.subscriptions.list({ customer, status: 'all', limit: 100 })
    const otherLive = existing.data.filter((s) => isLiveSubscriptionStatus(s.status))
    if (otherLive.length > 0) {
      return await fail('This customer already has a live hosting plan. Nothing was charged.', {
        publish_attempts: attempt,
      })
    }

    const priceId = await (deps.stepPriceId ?? ((id: PlanStepId) => getStepPriceId(id, stripe)))(step.id)
    const items: Stripe.SubscriptionCreateParams.Item[] = [{ price: priceId, quantity: 1 }]

    const sub = await stripe.subscriptions.create(
      {
        customer,
        default_payment_method: paymentMethod,
        items,
        off_session: true,
        payment_behavior: 'allow_incomplete',
        collection_method: 'charge_automatically',
        expand: ['latest_invoice'],
        metadata: {
          type: 'hosting',
          source: 'outreach',
          outreach_site_id: site.id,
          supabase_user_id: site.claimed_by,
          plan_step: step.id,
        },
      },
      { idempotencyKey: `outreach-publish:${site.id}:${attempt}` }
    )

    if (sub.status === 'active') {
      await store.updateSite(site.id, { publish_attempts: attempt })
      return await goLive(sub.id)
    }
    return await fail(failureMessage(sub), { stripe_subscription_id: sub.id, publish_attempts: attempt })
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e)
    return await fail(`Stripe error: ${msg}. The site stays unpublished.`)
  }
}

/** invoice.paid for an outreach subscription (e.g. after the customer finished 3D Secure). */
export async function markLiveFromPaidInvoice(
  deps: BillingDeps,
  invoice: Stripe.Invoice
): Promise<boolean> {
  const legacy = (invoice as unknown as { subscription?: string | { id: string } | null }).subscription
  const subId =
    idOf(invoice.parent?.subscription_details?.subscription as string | { id: string } | null | undefined) ??
    idOf(legacy ?? null)
  if (!subId || invoice.status !== 'paid') return false
  const site = await deps.store.getSiteBySubscription(subId)
  if (!site || site.publish_status === 'live') return false
  const now = (deps.now?.() ?? new Date()).toISOString()
  await deps.store.updateSite(site.id, {
    publish_status: 'live',
    published_at: now,
    publish_error: null,
  })
  return true
}
