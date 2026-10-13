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
const pricesList = vi.fn()
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
    prices: { list: pricesList },
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
import { PLAN_STEPS } from '@/lib/plans/ladder'
import { resetAddonPriceCache, resetStepPriceCache, resetTipPriceCache } from '@/lib/stripe/prices'
import { TIP_LOOKUP_KEY, TIP_PRODUCT_ID } from '@/lib/plans/ladder'
import { ADDON_TURN_OFF_FIRST, TIP_OUT_OF_RANGE } from '@/lib/plans/ladder-copy'
import { ADDONS } from '@/lib/plans/ladder'

const addonPrices = ADDONS.map((a) => ({
  id: `price_${a.id}`,
  lookup_key: a.lookupKey,
  product: a.productId,
  active: true,
  currency: 'usd',
  unit_amount: a.monthlyCents,
  type: 'recurring',
  recurring: { interval: 'month', interval_count: 1, usage_type: 'licensed' },
}))

/** Test-mode prices by lookup key, amounts from ladder.ts. */
function ladderPrices(over: (p: Record<string, unknown>) => Record<string, unknown> = (p) => p) {
  return {
    data: PLAN_STEPS.map((st) =>
      over({
        id: `price_${st.id}`,
        lookup_key: st.lookupKey,
        product: st.productId,
        active: true,
        currency: 'usd',
        unit_amount: st.monthlyCents,
        type: 'recurring',
        recurring: { interval: 'month', interval_count: 1 },
      })
    ),
  }
}

const tipPrice = {
  id: 'price_tip',
  lookup_key: TIP_LOOKUP_KEY,
  product: TIP_PRODUCT_ID,
  active: true,
  currency: 'usd',
  unit_amount: 100,
  type: 'recurring',
  recurring: { interval: 'month', interval_count: 1 },
}

function req(body: unknown = { planStep: 'fast_lane' }) {
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
      pricesList,
    ])
      m.mockReset()
    resetStepPriceCache()
    resetTipPriceCache()
    resetAddonPriceCache()
    pricesList.mockImplementation(async (q: { lookup_keys: string[] }) =>
      q.lookup_keys[0] === TIP_LOOKUP_KEY ? { data: [tipPrice] } : q.lookup_keys[0] === ADDONS[0].lookupKey ? { data: addonPrices } : ladderPrices()
    )
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
    const [params, opts] = sessionsCreate.mock.calls[0]
    expect(opts.idempotencyKey).toMatch(/^hosting-checkout:[0-9a-f]{64}$/)
    // Every session expires an hour after creation (Aria, Oct 3 12:56), rounded down to the minute.
    const ttl = params.expires_at - Date.now() / 1000
    expect(ttl).toBeGreaterThan(58 * 60)
    expect(ttl).toBeLessThanOrEqual(3600)
    expect(params.expires_at % 60).toBe(0)
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

    it('still validates the plan step (and refuses the retired slider / add-ons)', async () => {
      expect((await POST(req({ planStep: 'gold' }))).status).toBe(400)
      expect((await POST(req({}))).status).toBe(400)
      expect((await POST(req({ planStep: 'starter', addonTier: 'pro' }))).status).toBe(400)
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
            plan_step: 'fast_lane',
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
            plan_step: 'priority',
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

  describe('hosting ladder (Oct 3)', () => {
    beforeEach(() => {
      subsList.mockResolvedValue({ data: [] })
    })

    it.each([
      [{ hostingMonthlyCents: 3500 }],
      [{ planStep: 'starter', addonTier: 'basic' }],
      [{ planStep: 'starter', includeAddon: true }],
      [{ addonTier: 'none' }],
    ])('400: rejects the retired slider/add-on fields %j', async (body) => {
      const res = await POST(req(body))
      expect(res.status).toBe(400)
      expect(sessionsCreate).not.toHaveBeenCalled()
    })

    it.each(['gold', 'basic', 'plus', 'pro', '', null, 55])('400: unknown step %j', async (planStep) => {
      expect((await POST(req({ planStep }))).status).toBe(400)
      expect(sessionsCreate).not.toHaveBeenCalled()
    })

    it.each(PLAN_STEPS.filter((s) => !s.sellable).map((s) => [s.id] as const))(
      'sellable=false: 400 not_sellable for %s, before any Stripe call',
      async (id) => {
        const res = await POST(req({ planStep: id }))
        expect(res.status).toBe(400)
        expect(await res.json()).toMatchObject({ code: 'not_sellable' })
        expect(pricesList).not.toHaveBeenCalled()
        expect(subsList).not.toHaveBeenCalled()
        expect(sessionsCreate).not.toHaveBeenCalled()
      }
    )

    it('sellable is read from ladder.ts on every request (flip a step off: refused; back on: sold)', async () => {
      const step = PLAN_STEPS.find((s) => s.id === 'priority')! as { sellable: boolean }
      step.sellable = false
      try {
        expect((await POST(req({ planStep: 'priority' }))).status).toBe(400)
      } finally {
        step.sellable = true
      }
      expect((await POST(req({ planStep: 'priority' }))).status).toBe(200)
    })

    it.each(PLAN_STEPS.filter((s) => s.sellable).map((s) => [s.id] as const))(
      '%s: one line item, the lookup-key price, plan_step metadata on session and subscription',
      async (id) => {
        const res = await POST(req({ planStep: id }))
        expect(res.status).toBe(200)
        expect(pricesList).toHaveBeenCalledWith({
          lookup_keys: PLAN_STEPS.map((s) => s.lookupKey),
          active: true,
          limit: 100,
        })
        const [params] = sessionsCreate.mock.calls[0]
        expect(params.line_items).toEqual([{ price: `price_${id}`, quantity: 1 }])
        expect(JSON.stringify(params)).not.toContain('price_data')
        expect(params.metadata).toEqual({ type: 'hosting', plan_step: id, tip_dollars: '0' })
        expect(params.subscription_data.metadata).toMatchObject({ type: 'hosting', plan_step: id, tip_dollars: '0' })
        // no tip: the tip price is never even looked up
        expect(pricesList.mock.calls.some(([q]) => q.lookup_keys.includes(TIP_LOOKUP_KEY))).toBe(false)
      }
    )

    it('idempotency key differs per step', async () => {
      await POST(req({ planStep: 'starter' }))
      await POST(req({ planStep: 'fast_lane' }))
      const k1 = sessionsCreate.mock.calls[0][1].idempotencyKey
      const k2 = sessionsCreate.mock.calls[1][1].idempotencyKey
      expect(k1).not.toBe(k2)
    })

    it('503 (fails closed) when the step price is missing, and no open session is expired', async () => {
      pricesList.mockResolvedValue({ data: [] })
      sessionsList.mockResolvedValue({
        data: [{ id: 'cs_open', mode: 'subscription', url: 'https://x', metadata: { type: 'hosting', plan_step: 'starter' } }],
      })
      const res = await POST(req({ planStep: 'priority' }))
      expect(res.status).toBe(503)
      expect(sessionsExpire).not.toHaveBeenCalled()
      expect(sessionsCreate).not.toHaveBeenCalled()
    })

    it('503 when the Stripe price amount does not match ladder.ts (never charge a drifted amount)', async () => {
      pricesList.mockResolvedValue(ladderPrices((p) => (p.id === 'price_fast_lane' ? { ...p, unit_amount: 7000 } : p)))
      expect((await POST(req({ planStep: 'fast_lane' }))).status).toBe(503)
      expect(sessionsCreate).not.toHaveBeenCalled()
    })

    it('503 when Stripe cannot list prices', async () => {
      pricesList.mockRejectedValue(new Error('network'))
      expect((await POST(req({ planStep: 'starter' }))).status).toBe(503)
    })
  })

  describe('the tipping system (optional monthly tip)', () => {
    beforeEach(() => subsList.mockResolvedValue({ data: [] }))

    it('a $5 tip on Fast lane: the step price x1 + the $1 tip price x5 ($70), tip_dollars metadata on session and subscription', async () => {
      const res = await POST(req({ planStep: 'fast_lane', tipDollars: 5 }))
      expect(res.status).toBe(200)
      const [params] = sessionsCreate.mock.calls[0]
      expect(params.line_items).toEqual([
        { price: 'price_fast_lane', quantity: 1 },
        { price: 'price_tip', quantity: 5 },
      ])
      expect(params.metadata).toMatchObject({ plan_step: 'fast_lane', tip_dollars: '5' })
      expect(params.subscription_data.metadata).toMatchObject({ plan_step: 'fast_lane', tip_dollars: '5' })
    })

    it.each([
      ['over the range max', 'starter', 20],
      ['negative', 'priority', -1],
      ['not whole dollars', 'fast_lane', 2.5],
      ['a string', 'fast_lane', '3'],
    ])('400 tip_out_of_range when the tip is %s; nothing reaches Stripe', async (_l, planStep, tipDollars) => {
      const res = await POST(req({ planStep, tipDollars }))
      expect(res.status).toBe(400)
      expect(await res.json()).toEqual({ error: TIP_OUT_OF_RANGE, code: 'tip_out_of_range' })
      expect(sessionsCreate).not.toHaveBeenCalled()
    })

    it('the range top is allowed (Starter $35 + $19 = $54)', async () => {
      expect((await POST(req({ planStep: 'starter', tipDollars: 19 }))).status).toBe(200)
      expect(sessionsCreate.mock.calls[0][0].line_items[1]).toEqual({ price: 'price_tip', quantity: 19 })
    })

    it('503 (fails closed) when the tip price is missing or drifted, only if a tip was chosen', async () => {
      pricesList.mockImplementation(async (q: { lookup_keys: string[] }) =>
        q.lookup_keys[0] === TIP_LOOKUP_KEY ? { data: [{ ...tipPrice, unit_amount: 200 }] } : ladderPrices()
      )
      expect((await POST(req({ planStep: 'fast_lane', tipDollars: 3 }))).status).toBe(503)
      expect(sessionsCreate).not.toHaveBeenCalled()
      expect((await POST(req({ planStep: 'fast_lane', tipDollars: 0 }))).status).toBe(200)
    })

    it('an open session is reused only for the same step AND the same tip; the idempotency key includes the tip', async () => {
      sessionsList.mockResolvedValue({
        data: [{ id: 'cs_open', mode: 'subscription', url: 'https://x/open', metadata: { type: 'hosting', plan_step: 'fast_lane', tip_dollars: '5' } }],
      })
      const same = await POST(req({ planStep: 'fast_lane', tipDollars: 5 }))
      expect((await same.json()).url).toBe('https://x/open')
      expect(sessionsCreate).not.toHaveBeenCalled()
      await POST(req({ planStep: 'fast_lane', tipDollars: 6 }))
      expect(sessionsExpire).toHaveBeenCalledWith('cs_open')
      expect(sessionsCreate).toHaveBeenCalledTimes(1)
      sessionsList.mockResolvedValue({ data: [] })
      await POST(req({ planStep: 'fast_lane', tipDollars: 7 }))
      expect(sessionsCreate.mock.calls[0][1].idempotencyKey).not.toBe(sessionsCreate.mock.calls[1][1].idempotencyKey)
    })
  })

  describe('add-ons at checkout (Oct 4)', () => {
    beforeEach(() => subsList.mockResolvedValue({ data: [] }))

    it('Starter + both add-ons + $8 tip: step x1, each add-on x1, tip x8 ($53.75); addons metadata', async () => {
      const res = await POST(req({ planStep: 'starter', addons: ['big_change', 'small_edit'], tipDollars: 8 }))
      expect(res.status).toBe(200)
      const [params] = sessionsCreate.mock.calls[0]
      expect(params.line_items).toEqual([
        { price: 'price_starter', quantity: 1 },
        { price: 'price_small_edit', quantity: 1 },
        { price: 'price_big_change', quantity: 1 },
        { price: 'price_tip', quantity: 8 },
      ])
      expect(params.metadata).toMatchObject({ plan_step: 'starter', tip_dollars: '8', addons: 'small_edit,big_change' })
      expect(params.subscription_data.metadata).toMatchObject({ addons: 'small_edit,big_change' })
    })

    it.each([
      [['small_edit'], 15],
      [['big_change'], 14],
      [['small_edit', 'big_change'], 9],
    ])('Starter with %j: a $%i tip passes $54 and is refused', async (addons, tipDollars) => {
      const res = await POST(req({ planStep: 'starter', addons, tipDollars }))
      expect(res.status).toBe(400)
      expect(await res.json()).toEqual({ error: TIP_OUT_OF_RANGE, code: 'tip_out_of_range' })
      expect(sessionsCreate).not.toHaveBeenCalled()
    })

    it('other steps: add-ons do not lower the tip range (Priority + both + $9)', async () => {
      expect((await POST(req({ planStep: 'priority', addons: ['small_edit', 'big_change'], tipDollars: 9 }))).status).toBe(200)
    })

    it.each([
      ['a repeat', ['small_edit', 'small_edit']],
      ['coming soon', ['visitor_snapshot']],
      ['retired quote alert', ['quote_alert']],
      ['not a list', 'small_edit'],
    ])('400 invalid_addons for %s; nothing reaches Stripe', async (_l, addons) => {
      const res = await POST(req({ planStep: 'priority', addons }))
      expect(res.status).toBe(400)
      expect((await res.json()).code).toBe('invalid_addons')
      expect(pricesList).not.toHaveBeenCalled()
    })

    it('503 (fails closed) when an add-on price drifted from ladder.ts', async () => {
      pricesList.mockImplementation(async (q: { lookup_keys: string[] }) =>
        q.lookup_keys[0] === ADDONS[0].lookupKey ? { data: addonPrices.map((p) => ({ ...p, unit_amount: p.unit_amount + 100 })) } : ladderPrices()
      )
      expect((await POST(req({ planStep: 'priority', addons: ['big_change'] }))).status).toBe(503)
      expect(sessionsCreate).not.toHaveBeenCalled()
    })

    it('an open session is reused only with the same add-ons', async () => {
      sessionsList.mockResolvedValue({
        data: [{ id: 'cs_open', mode: 'subscription', url: 'https://x/open', metadata: { type: 'hosting', plan_step: 'priority', tip_dollars: '0', addons: 'small_edit' } }],
      })
      expect((await (await POST(req({ planStep: 'priority', addons: ['small_edit'] }))).json()).url).toBe('https://x/open')
      await POST(req({ planStep: 'priority', addons: ['small_edit', 'big_change'] }))
      expect(sessionsExpire).toHaveBeenCalledWith('cs_open')
    })

    it('the cap message is "Turn off an add-on first" (never reached with today\'s two add-ons)', () => {
      expect(ADDON_TURN_OFF_FIRST).toBe('Turn off an add-on first')
    })
  })
})
