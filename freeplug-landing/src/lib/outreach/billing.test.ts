// @vitest-environment node
import { describe, expect, it, vi } from 'vitest'
import type Stripe from 'stripe'
import {
  completeSetupSession,
  markLiveFromPaidInvoice,
  publishOutreachSite,
  type OutreachBillingSite,
  type OutreachBillingStore,
  type OutreachSitePatch,
  LEGACY_PLAN_PUBLISH_ERROR,
  STEP_NOT_SELLABLE_PUBLISH_ERROR,
} from './billing'
import { PLAN_STEPS } from '@/lib/plans/ladder'
import { resetStepPriceCache } from '@/lib/stripe/prices'

function site(over: Partial<OutreachBillingSite> = {}): OutreachBillingSite {
  return {
    id: 'site-1',
    business_name: "Gracia's Lawn Service",
    claimed_by: 'user-1',
    plan_step: 'priority',
    plan_hosting_cents: null,
    plan_addon_tier: null,
    setup_session_id: 'cs_setup_1',
    setup_completed_at: '2026-09-27T05:00:00Z',
    stripe_customer_id: 'cus_1',
    stripe_payment_method_id: 'pm_1',
    stripe_subscription_id: null,
    publish_status: 'none',
    publish_attempts: 0,
    live_url: null,
    ...over,
  }
}

function fakeStore(initial: OutreachBillingSite) {
  let row = { ...initial }
  const patches: OutreachSitePatch[] = []
  const store: OutreachBillingStore = {
    getSite: async (id) => (id === row.id ? { ...row } : null),
    getSiteBySetupSession: async (sid) => (sid === row.setup_session_id ? { ...row } : null),
    getSiteBySubscription: async (sid) => (sid === row.stripe_subscription_id ? { ...row } : null),
    beginPublish: async () => {
      if (row.publish_status === 'processing' || row.publish_status === 'live') return false
      row = { ...row, publish_status: 'processing' }
      return true
    },
    updateSite: async (_id, patch) => {
      patches.push(patch)
      row = { ...row, ...(patch as Partial<OutreachBillingSite>) }
    },
    setProfileCustomer: vi.fn(async () => {}),
  }
  return { store, patches, get row() { return row } }
}

function fakeStripe(subStatus: Stripe.Subscription.Status = 'active') {
  const create = vi.fn(async () => ({
    id: 'sub_new',
    status: subStatus,
    latest_invoice: { id: 'in_1', hosted_invoice_url: 'https://pay.stripe.test/in_1' },
  }))
  const stripe = {
    subscriptions: {
      create,
      list: vi.fn(async () => ({ data: [] })),
      retrieve: vi.fn(),
    },
    products: {
      retrieve: vi.fn(async (id: string) => ({ id })),
      create: vi.fn(),
    },
    // Ladder prices by lookup key (amounts from ladder.ts).
    prices: {
      list: vi.fn(async () => ({
        data: PLAN_STEPS.map((st) => ({
          id: `price_${st.id}`,
          lookup_key: st.lookupKey,
          product: st.productId,
          active: true,
          currency: 'usd',
          unit_amount: st.monthlyCents,
          type: 'recurring',
          recurring: { interval: 'month', interval_count: 1 },
        })),
      })),
    },
    invoices: { pay: vi.fn() },
    customers: { update: vi.fn(async () => ({})) },
    setupIntents: { retrieve: vi.fn(async () => ({ status: 'succeeded', payment_method: 'pm_9' })) },
  }
  return { stripe: stripe as unknown as Stripe, raw: stripe, create }
}

describe('setup-mode webhook branch (card saved, nothing charged)', () => {
  const session = (over: Record<string, unknown> = {}) =>
    ({
      id: 'cs_setup_1',
      mode: 'setup',
      status: 'complete',
      customer: 'cus_9',
      setup_intent: 'seti_1',
      metadata: { type: 'outreach_setup', outreach_site_id: 'site-1', supabase_user_id: 'user-1' },
      ...over,
    }) as unknown as Stripe.Checkout.Session

  it('ignores payment and subscription sessions (the existing webhook path handles them)', async () => {
    const f = fakeStore(site({ setup_completed_at: null }))
    const s = fakeStripe()
    expect(await completeSetupSession({ stripe: s.stripe, store: f.store }, session({ mode: 'subscription' }))).toEqual({ handled: false })
    expect(await completeSetupSession({ stripe: s.stripe, store: f.store }, session({ mode: 'payment' }))).toEqual({ handled: false })
  })

  it('saves the card as the default payment method and never creates a subscription', async () => {
    const f = fakeStore(site({ setup_completed_at: null, stripe_customer_id: null, stripe_payment_method_id: null }))
    const s = fakeStripe()
    const res = await completeSetupSession({ stripe: s.stripe, store: f.store }, session())
    expect(res).toEqual({ handled: true, outcome: 'saved', siteId: 'site-1' })
    expect(s.raw.customers.update).toHaveBeenCalledWith('cus_9', { invoice_settings: { default_payment_method: 'pm_9' } })
    expect(f.row.setup_completed_at).toBeTruthy()
    expect(f.row.stripe_payment_method_id).toBe('pm_9')
    expect(s.create).not.toHaveBeenCalled()
  })

  it('is idempotent and refuses a session whose metadata does not match the claimer', async () => {
    const f = fakeStore(site())
    const s = fakeStripe()
    expect(await completeSetupSession({ stripe: s.stripe, store: f.store }, session())).toMatchObject({ outcome: 'already_saved' })
    const g = fakeStore(site({ setup_completed_at: null }))
    const bad = session({ metadata: { type: 'outreach_setup', outreach_site_id: 'site-1', supabase_user_id: 'someone-else' } })
    expect(await completeSetupSession({ stripe: s.stripe, store: g.store }, bad)).toMatchObject({ outcome: 'ignored' })
    expect(g.row.setup_completed_at).toBeNull()
  })
})

describe('admin Publish (off-session subscription)', () => {
  it('goes live only when the first invoice is paid, with a per-site idempotency key and the lookup-key price of the step', async () => {
    resetStepPriceCache()
    const f = fakeStore(site({ plan_step: 'fast_lane' }))
    const s = fakeStripe('active')
    const res = await publishOutreachSite({ stripe: s.stripe, store: f.store }, 'site-1', { claimerVerified: true })
    expect(res).toMatchObject({ ok: true, status: 'live', subscriptionId: 'sub_new' })
    const [params, opts] = s.create.mock.calls[0] as unknown as [Stripe.SubscriptionCreateParams, { idempotencyKey: string }]
    expect(opts.idempotencyKey).toBe('outreach-publish:site-1:0')
    expect(params.off_session).toBe(true)
    expect(params.items).toEqual([{ price: 'price_fast_lane', quantity: 1 }])
    expect(params.items?.[0]).not.toHaveProperty('price_data')
    expect((params.metadata as Record<string, string>).plan_step).toBe('fast_lane')
    expect(params.metadata).not.toHaveProperty('addon_tier')
    expect(f.row.publish_status).toBe('live')
  })

  it('refuses a site that only has a pre-ladder (slider/add-on) choice, and charges nothing', async () => {
    const f = fakeStore(site({ plan_step: null, plan_hosting_cents: 4000, plan_addon_tier: 'pro' }))
    const s = fakeStripe('active')
    const res = await publishOutreachSite({ stripe: s.stripe, store: f.store }, 'site-1', { claimerVerified: true })
    expect(res).toEqual({ ok: false, status: 'refused', error: LEGACY_PLAN_PUBLISH_ERROR })
    expect(s.create).not.toHaveBeenCalled()
  })

  it.each(PLAN_STEPS.filter((st) => !st.sellable).map((st) => [st.id] as const))(
    'sellable=false: refuses to publish %s on the server (no subscription, nothing charged, site not marked failed)',
    async (id) => {
      const f = fakeStore(site({ plan_step: id }))
      const s = fakeStripe('active')
      const res = await publishOutreachSite({ stripe: s.stripe, store: f.store }, 'site-1', { claimerVerified: true })
      expect(res).toEqual({ ok: false, status: 'refused', error: STEP_NOT_SELLABLE_PUBLISH_ERROR(PLAN_STEPS.find((x) => x.id === id)!.name) })
      expect(s.create).not.toHaveBeenCalled()
      expect(f.row.publish_status).not.toBe('failed')
    }
  )

  it('a missing step price fails the publish (no subscription, site stays unpublished)', async () => {
    const f = fakeStore(site({ plan_step: 'priority' }))
    const s = fakeStripe('active')
    const res = await publishOutreachSite(
      { stripe: s.stripe, store: f.store, stepPriceId: async () => { throw new Error('No price for priority') } },
      'site-1',
      { claimerVerified: true }
    )
    expect(res).toMatchObject({ ok: false, status: 'failed' })
    expect(s.create).not.toHaveBeenCalled()
    expect(f.row.publish_status).toBe('failed')
  })

  it('a double click does not create a second subscription (same key, and the second call is refused while running)', async () => {
    const f = fakeStore(site())
    const s = fakeStripe('active')
    const [a, b] = await Promise.all([
      publishOutreachSite({ stripe: s.stripe, store: f.store }, 'site-1', { claimerVerified: true }),
      publishOutreachSite({ stripe: s.stripe, store: f.store }, 'site-1', { claimerVerified: true }),
    ])
    expect([a.ok, b.ok].filter(Boolean).length).toBe(1)
    expect(s.create).toHaveBeenCalledTimes(1)
    const again = await publishOutreachSite({ stripe: s.stripe, store: f.store }, 'site-1', { claimerVerified: true })
    expect(again).toMatchObject({ ok: true, already: true })
    expect(s.create).toHaveBeenCalledTimes(1)
  })

  it('a failed card (or 3D Secure) keeps the site unpublished and tells admin why', async () => {
    const f = fakeStore(site())
    const s = fakeStripe('incomplete')
    const res = await publishOutreachSite({ stripe: s.stripe, store: f.store }, 'site-1', { claimerVerified: true })
    expect(res.ok).toBe(false)
    expect(f.row.publish_status).toBe('failed')
    expect(f.patches.some((p) => p.published_at)).toBe(false)
    expect(res.ok ? '' : res.error).toContain('stays unpublished')
    expect(res.ok ? '' : res.error).toContain('https://pay.stripe.test/in_1')
  })

  it('refuses when no card is on file, and creates no subscription', async () => {
    const f = fakeStore(site({ setup_completed_at: null, stripe_payment_method_id: null }))
    const s = fakeStripe()
    const res = await publishOutreachSite({ stripe: s.stripe, store: f.store }, 'site-1', { claimerVerified: true })
    expect(res).toMatchObject({ ok: false, status: 'refused' })
    expect(s.create).not.toHaveBeenCalled()
    expect(f.row.publish_status).toBe('none')
  })

  it('publishing twice in a row creates one subscription', async () => {
    const f = fakeStore(site())
    const s = fakeStripe('active')
    const first = await publishOutreachSite({ stripe: s.stripe, store: f.store }, 'site-1', { claimerVerified: true })
    const second = await publishOutreachSite({ stripe: s.stripe, store: f.store }, 'site-1', { claimerVerified: true })
    expect(first).toMatchObject({ ok: true, status: 'live', subscriptionId: 'sub_new' })
    expect(second).toMatchObject({ ok: true, already: true, subscriptionId: 'sub_new' })
    expect(s.create).toHaveBeenCalledTimes(1)
  })

  it('refuses without "Claimer verified as the business"', async () => {
    const f = fakeStore(site())
    const s = fakeStripe()
    const res = await publishOutreachSite({ stripe: s.stripe, store: f.store }, 'site-1', { claimerVerified: false })
    expect(res).toMatchObject({ ok: false, status: 'refused' })
    expect(s.create).not.toHaveBeenCalled()
  })

  it('invoice.paid after 3D Secure marks the site live', async () => {
    const f = fakeStore(site({ stripe_subscription_id: 'sub_new', publish_status: 'failed' }))
    const s = fakeStripe()
    const ok = await markLiveFromPaidInvoice(
      { stripe: s.stripe, store: f.store },
      { status: 'paid', parent: { subscription_details: { subscription: 'sub_new' } } } as unknown as Stripe.Invoice
    )
    expect(ok).toBe(true)
    expect(f.row.publish_status).toBe('live')
  })
})
