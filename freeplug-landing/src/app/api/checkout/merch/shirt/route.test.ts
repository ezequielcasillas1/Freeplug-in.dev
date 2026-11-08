import { afterEach, describe, expect, it, vi } from 'vitest'
import { POST } from './route'

vi.mock('@/lib/rate-limit', () => ({
  rateCheck: vi.fn().mockResolvedValue(true),
}))

const create = vi.fn().mockResolvedValue({ url: 'https://checkout.stripe.test/cs_shirt' })

vi.mock('@/lib/stripe/server', () => ({
  getStripeFetch: () => ({
    checkout: { sessions: { create } },
  }),
}))

vi.mock('@/i18n/current-locale', () => ({
  currentLocale: vi.fn().mockResolvedValue('en'),
}))

vi.mock('@/app/claim/start/claim-redirect', () => ({
  isSameOriginPost: () => true,
}))

vi.mock('@/lib/site', () => ({
  emailBaseUrl: () => 'http://localhost:3000',
}))

describe('POST /api/checkout/merch/shirt', () => {
  afterEach(() => {
    vi.unstubAllEnvs()
    create.mockClear()
  })

  it('returns 403 when MERCH_SHIRTS_ENABLED is off', async () => {
    vi.stubEnv('MERCH_SHIRTS_ENABLED', 'false')
    vi.stubEnv('STRIPE_SECRET_KEY', 'sk_test_x')
    const req = new Request('http://localhost:3000/api/checkout/merch/shirt', {
      method: 'POST',
      headers: { origin: 'http://localhost:3000', 'content-type': 'application/json' },
      body: JSON.stringify({ slug: '03-get-plugged-in', color: 'Black', size: 'M', quantity: 1 }),
    })
    expect((await POST(req)).status).toBe(403)
  })

  it('rejects client-sent price', async () => {
    vi.stubEnv('MERCH_SHIRTS_ENABLED', 'true')
    vi.stubEnv('STRIPE_SECRET_KEY', 'sk_test_x')
    const req = new Request('http://localhost:3000/api/checkout/merch/shirt', {
      method: 'POST',
      headers: { origin: 'http://localhost:3000', 'content-type': 'application/json' },
      body: JSON.stringify({
        slug: '03-get-plugged-in',
        color: 'Black',
        size: 'M',
        quantity: 1,
        unitAmountCents: 100,
      }),
    })
    expect((await POST(req)).status).toBe(400)
    expect(create).not.toHaveBeenCalled()
  })

  it('creates session with server price and shipping for front-only shirt', async () => {
    vi.stubEnv('MERCH_SHIRTS_ENABLED', 'true')
    vi.stubEnv('STRIPE_SECRET_KEY', 'sk_test_x')
    const req = new Request('http://localhost:3000/api/checkout/merch/shirt', {
      method: 'POST',
      headers: { origin: 'http://localhost:3000', 'content-type': 'application/json' },
      body: JSON.stringify({ slug: '03-get-plugged-in', color: 'Black', size: 'M', quantity: 2 }),
    })
    const res = await POST(req)
    expect(res.status).toBe(200)
    expect(create).toHaveBeenCalledWith(
      expect.objectContaining({
        line_items: [
          expect.objectContaining({
            price_data: expect.objectContaining({ unit_amount: 1599 }),
            quantity: 2,
          }),
        ],
        shipping_options: [
          expect.objectContaining({
            shipping_rate_data: expect.objectContaining({
              fixed_amount: expect.objectContaining({ amount: 495 + 240 }),
            }),
          }),
        ],
        metadata: expect.objectContaining({ checkout_type: 'merch_shirt', product_slug: '03-get-plugged-in' }),
      })
    )
  })

  it('uses front+back price for design 01', async () => {
    vi.stubEnv('MERCH_SHIRTS_ENABLED', 'true')
    vi.stubEnv('STRIPE_SECRET_KEY', 'sk_test_x')
    const req = new Request('http://localhost:3000/api/checkout/merch/shirt', {
      method: 'POST',
      headers: { origin: 'http://localhost:3000', 'content-type': 'application/json' },
      body: JSON.stringify({ slug: '01-know-a-plug', color: 'White', size: 'XL', quantity: 1 }),
    })
    await POST(req)
    expect(create).toHaveBeenCalledWith(
      expect.objectContaining({
        line_items: [expect.objectContaining({ price_data: expect.objectContaining({ unit_amount: 2199 }) })],
        shipping_options: [
          expect.objectContaining({
            shipping_rate_data: expect.objectContaining({
              fixed_amount: expect.objectContaining({ amount: 495 }),
            }),
          }),
        ],
      })
    )
  })
})
