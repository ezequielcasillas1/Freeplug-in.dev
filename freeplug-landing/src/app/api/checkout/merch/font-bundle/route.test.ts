// @vitest-environment node
import { beforeEach, describe, expect, it, vi } from 'vitest'

const sessionsCreate = vi.fn()

vi.mock('@/lib/stripe/server', () => ({
  getStripe: () => ({
    checkout: { sessions: { create: sessionsCreate } },
  }),
}))
vi.mock('@/i18n/current-locale', () => ({
  currentLocale: async () => 'en',
}))

import { POST } from './route'

describe('POST /api/checkout/merch/font-bundle', () => {
  beforeEach(() => {
    sessionsCreate.mockReset()
    delete process.env.MERCH_MOCK_CHECKOUT
    process.env.STRIPE_SECRET_KEY = 'sk_test_unit'
    process.env.MERCH_CHECKOUT_ENABLED = 'true'
  })

  it('creates a Stripe Checkout session in payment mode', async () => {
    sessionsCreate.mockResolvedValue({ url: 'https://checkout.stripe.test/cs' })
    const req = new Request('http://localhost:3000/api/checkout/merch/font-bundle', {
      method: 'POST',
      headers: { origin: 'http://localhost:3000', 'content-type': 'application/json' },
      body: JSON.stringify({ email: 'buyer@example.com' }),
    })
    const res = await POST(req)
    expect(res.status).toBe(200)
    const json = (await res.json()) as { url: string }
    expect(json.url).toContain('checkout.stripe')
    expect(sessionsCreate).toHaveBeenCalledWith(
      expect.objectContaining({
        mode: 'payment',
        metadata: expect.objectContaining({ checkout_type: 'merch_font_bundle' }),
      })
    )
    expect(sessionsCreate.mock.calls[0][0]).not.toHaveProperty('automatic_payment_methods')
  })

  it('returns 403 when MERCH_CHECKOUT_ENABLED is off', async () => {
    process.env.MERCH_CHECKOUT_ENABLED = 'false'
    const req = new Request('http://localhost:3000/api/checkout/merch/font-bundle', {
      method: 'POST',
      headers: { origin: 'http://localhost:3000', 'content-type': 'application/json' },
      body: '{}',
    })
    expect((await POST(req)).status).toBe(403)
  })

  it('returns mock url when MERCH_MOCK_CHECKOUT=true and no Stripe key', async () => {
    delete process.env.STRIPE_SECRET_KEY
    process.env.MERCH_MOCK_CHECKOUT = 'true'
    const req = new Request('http://localhost:3000/api/checkout/merch/font-bundle', {
      method: 'POST',
      headers: { origin: 'http://localhost:3000', 'content-type': 'application/json' },
      body: '{}',
    })
    const res = await POST(req)
    const json = (await res.json()) as { mock: boolean; url: string }
    expect(res.status).toBe(200)
    expect(json.mock).toBe(true)
    expect(json.url).toContain('session_id=')
  })
})
