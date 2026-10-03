// @vitest-environment node
import { beforeEach, describe, expect, it, vi } from 'vitest'

const getUser = vi.fn()
const plansAllowed = vi.fn()
const subsList = vi.fn()
const sessionsCreate = vi.fn()
const sessionsList = vi.fn()
const sessionsExpire = vi.fn()
const customersList = vi.fn()
const customersCreate = vi.fn()
const profileUpdate = vi.fn()
const outreachWaiting = vi.fn()
let ctxCustomerId: string | null = 'cus_test'

vi.mock('@/lib/supabase/server', () => ({
  createClient: async () => ({ auth: { getUser } }),
}))
vi.mock('@/lib/dashboard/plans-eligibility', () => ({
  isPlansCheckoutAllowed: (...args: unknown[]) => plansAllowed(...args),
}))
vi.mock('@/lib/supabase/admin', () => ({
  createAdminClient: () => ({
    from: () => ({
      update: (values: unknown) => {
        profileUpdate(values)
        const chain = { eq: () => chain, is: async () => ({ error: null }) }
        return chain
      },
    }),
  }),
}))
vi.mock('@/lib/outreach/server', () => ({
  hasOutreachPlanWaitingForPublish: (...args: unknown[]) => outreachWaiting(...args),
}))
vi.mock('@/lib/stripe/server', () => ({
  getStripe: () => ({
    subscriptions: { list: subsList },
    customers: { list: customersList, create: customersCreate },
    checkout: {
      sessions: {
        create: sessionsCreate,
        list: sessionsList,
        expire: sessionsExpire,
      },
    },
  }),
}))
vi.mock('@/lib/stripe/checkout-context', () => ({
  getCheckoutSessionContext: async () => ({
    paths: {
      base: 'http://localhost:3000',
      successPath: '/dashboard',
      cancelPath: '/dashboard',
    },
    user: { id: 'u1', email: 'u1@example.com' },
    stripeCustomerId: ctxCustomerId,
  }),
  applyUserToCheckoutSession: (p: object, _ctx: unknown, metadata: object) => ({
    ...p,
    metadata,
  }),
}))

import { POST } from './route'

function req(body: unknown = { hostingMonthlyCents: 3500, addonTier: 'pro' }) {
  return new Request('http://localhost:3000/api/checkout/hosting', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(body),
  })
}

describe('POST /api/checkout/hosting', () => {
  beforeEach(() => {
    for (const m of [
      getUser,
      plansAllowed,
      subsList,
      sessionsCreate,
      sessionsList,
      sessionsExpire,
      customersList,
      customersCreate,
      profileUpdate,
      outreachWaiting,
    ])
      m.mockReset()
    outreachWaiting.mockResolvedValue(false)
    customersList.mockResolvedValue({ data: [] })
    customersCreate.mockResolvedValue({ id: 'cus_new' })
    ctxCustomerId = 'cus_test'
    getUser.mockResolvedValue({ data: { user: { id: 'u1' } } })
    plansAllowed.mockResolvedValue(true)
    sessionsList.mockResolvedValue({ data: [] })
    sessionsCreate.mockResolvedValue({
      url: 'https://checkout.stripe.test/new',
    })
  })

  it('409 plan_waiting_for_publish when an outreach card is saved and waiting for publish (one-plan guard)', async () => {
    outreachWaiting.mockResolvedValue(true)
    subsList.mockResolvedValue({ data: [] })
    const res = await POST(req())
    expect(res.status).toBe(409)
    const body = await res.json()
    expect(body.code).toBe('plan_waiting_for_publish')
    expect(outreachWaiting).toHaveBeenCalledWith('u1')
    expect(sessionsCreate).not.toHaveBeenCalled()
  })

  it('503 (fails closed) when the outreach plan check errors', async () => {
    outreachWaiting.mockRejectedValue(new Error('db down'))
    const res = await POST(req())
    expect(res.status).toBe(503)
    expect(sessionsCreate).not.toHaveBeenCalled()
  })

  it('401 when signed out', async () => {
    getUser.mockResolvedValue({ data: { user: null } })
    const res = await POST(req())
    expect(res.status).toBe(401)
    expect(sessionsCreate).not.toHaveBeenCalled()
  })

  it.each(['active', 'trialing', 'past_due', 'unpaid'])(
    '409 when the customer already has a %s subscription',
    async (status) => {
      subsList.mockResolvedValue({ data: [{ id: 'sub_1', status }] })
      const res = await POST(req())
      expect(res.status).toBe(409)
      const body = await res.json()
      expect(body.error).toBe(
        'You already have an active hosting plan. Use Manage billing to change it.'
      )
      expect(subsList).toHaveBeenCalledWith({
        customer: 'cus_test',
        status: 'all',
        limit: 100,
      })
      expect(sessionsCreate).not.toHaveBeenCalled()
    }
  )

  it('200 and creates a session (with an idempotency key) when only ended subscriptions exist', async () => {
    subsList.mockResolvedValue({
      data: [
        { id: 'sub_old', status: 'canceled' },
        { id: 'sub_x', status: 'incomplete_expired' },
      ],
    })
    const res = await POST(req())
    expect(res.status).toBe(200)
    expect(await res.json()).toEqual({
      url: 'https://checkout.stripe.test/new',
    })
    const [, opts] = sessionsCreate.mock.calls[0]
    expect(opts.idempotencyKey).toMatch(/^hosting-checkout:[0-9a-f]{64}$/)
  })

  it('200 when the only subscription left is canceled (re-signup after hosting ended)', async () => {
    subsList.mockResolvedValue({
      data: [{ id: 'sub_old', status: 'canceled', cancel_at_period_end: false, cancel_at: null }],
    })
    const res = await POST(req())
    expect(res.status).toBe(200)
    expect(sessionsCreate).toHaveBeenCalledTimes(1)
  })

  it('409 plan_ending (resume instead) when the live plan is canceled but still running', async () => {
    subsList.mockResolvedValue({
      data: [{ id: 'sub_1', status: 'active', cancel_at_period_end: true, cancel_at: null }],
    })
    const res = await POST(req())
    expect(res.status).toBe(409)
    expect((await res.json()).code).toBe('plan_ending')
    expect(sessionsCreate).not.toHaveBeenCalled()
  })

  describe('first-time buyer (no Stripe customer saved on the profile)', () => {
    beforeEach(() => {
      ctxCustomerId = null
    })

    it('still runs the plan check: 409 when a Stripe customer with their email already has a live plan', async () => {
      customersList.mockResolvedValue({ data: [{ id: 'cus_unsynced', metadata: {} }] })
      subsList.mockResolvedValue({ data: [{ id: 'sub_1', status: 'active' }] })
      const res = await POST(req())
      expect(res.status).toBe(409)
      expect(customersList).toHaveBeenCalledWith({ email: 'u1@example.com', limit: 10 })
      expect(subsList).toHaveBeenCalledWith({ customer: 'cus_unsynced', status: 'all', limit: 100 })
      expect(customersCreate).not.toHaveBeenCalled()
      expect(sessionsCreate).not.toHaveBeenCalled()
    })

    it('gets one stable Stripe customer (idempotent per user), saved to the profile, then the race guard runs', async () => {
      const res = await POST(req())
      expect(res.status).toBe(200)
      const [params, opts] = customersCreate.mock.calls[0]
      expect(params).toEqual({ email: 'u1@example.com', metadata: { supabase_user_id: 'u1' } })
      expect(opts).toEqual({ idempotencyKey: 'checkout-customer:u1' })
      expect(profileUpdate).toHaveBeenCalledWith(
        expect.objectContaining({ stripe_customer_id: 'cus_new' })
      )
      expect(sessionsList).toHaveBeenCalledWith({ customer: 'cus_new', status: 'open', limit: 10 })
      expect(sessionsCreate.mock.calls[0][0]).toEqual(
        expect.objectContaining({ mode: 'subscription' })
      )
    })

    it('reuses their own existing Stripe customer instead of creating another', async () => {
      customersList.mockResolvedValue({
        data: [{ id: 'cus_mine', metadata: { supabase_user_id: 'u1' } }],
      })
      subsList.mockResolvedValue({ data: [] })
      const res = await POST(req())
      expect(res.status).toBe(200)
      expect(customersCreate).not.toHaveBeenCalled()
      expect(sessionsList).toHaveBeenCalledWith({ customer: 'cus_mine', status: 'open', limit: 10 })
    })

    it('still validates the amount and add-on tier', async () => {
      expect((await POST(req({ hostingMonthlyCents: 999999, addonTier: 'pro' }))).status).toBe(400)
      expect((await POST(req({ hostingMonthlyCents: 3500, addonTier: 'gold' }))).status).toBe(400)
      expect(customersCreate).not.toHaveBeenCalled()
      expect(sessionsCreate).not.toHaveBeenCalled()
    })

    it('503 (fails closed) when the customer lookup cannot reach Stripe', async () => {
      customersList.mockRejectedValue(new Error('network'))
      const res = await POST(req())
      expect(res.status).toBe(503)
      expect(sessionsCreate).not.toHaveBeenCalled()
    })
  })

  it('reuses an open session for the same plan and expires one for a different plan', async () => {
    subsList.mockResolvedValue({ data: [] })
    sessionsList.mockResolvedValue({
      data: [
        {
          id: 'cs_same',
          mode: 'subscription',
          url: 'https://checkout.stripe.test/same',
          metadata: {
            type: 'hosting',
            hosting_monthly_cents: '3500',
            addon_tier: 'pro',
          },
        },
      ],
    })
    let res = await POST(req())
    expect(await res.json()).toEqual({
      url: 'https://checkout.stripe.test/same',
    })
    expect(sessionsCreate).not.toHaveBeenCalled()

    sessionsList.mockResolvedValue({
      data: [
        {
          id: 'cs_other',
          mode: 'subscription',
          url: 'https://checkout.stripe.test/other',
          metadata: {
            type: 'hosting',
            hosting_monthly_cents: '5000',
            addon_tier: 'none',
          },
        },
      ],
    })
    res = await POST(req())
    expect(res.status).toBe(200)
    expect(sessionsExpire).toHaveBeenCalledWith('cs_other')
    expect(sessionsCreate).toHaveBeenCalledTimes(1)
  })

  it('503 (fails closed) when the plan check cannot reach Stripe', async () => {
    subsList.mockRejectedValue(new Error('network'))
    const res = await POST(req())
    expect(res.status).toBe(503)
    expect(sessionsCreate).not.toHaveBeenCalled()
  })
})
