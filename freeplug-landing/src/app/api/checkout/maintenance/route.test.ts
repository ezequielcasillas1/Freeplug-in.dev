// @vitest-environment node
import { beforeEach, describe, expect, it, vi } from 'vitest'

const getUser = vi.fn()
const sessionsCreate = vi.fn()

vi.mock('@/lib/supabase/server', () => ({
  createClient: async () => ({ auth: { getUser } }),
}))
vi.mock('@/lib/stripe/server', () => ({
  getStripe: () => ({ checkout: { sessions: { create: sessionsCreate } } }),
}))
vi.mock('@/lib/stripe/checkout-context', () => ({
  getCheckoutSessionContext: async () => ({
    paths: { base: 'http://localhost:3000', successPath: '/dashboard', cancelPath: '/dashboard' },
    user: { id: 'u1', email: 'u1@example.com' },
    stripeCustomerId: null,
  }),
  applyUserToCheckoutSession: (p: object) => p,
}))

import { POST } from './route'

function req(body: unknown) {
  return new Request('http://localhost:3000/api/checkout/maintenance', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(body),
  })
}

describe('POST /api/checkout/maintenance', () => {
  beforeEach(() => {
    getUser.mockReset()
    sessionsCreate.mockReset()
  })

  it('returns 401 for anonymous callers and never touches Stripe', async () => {
    getUser.mockResolvedValue({ data: { user: null } })
    const res = await POST(req({ maintenanceCents: 5000 }))
    expect(res.status).toBe(401)
    expect(sessionsCreate).not.toHaveBeenCalled()
  })

  it('still rejects amounts outside $50–$100 for signed-in users', async () => {
    getUser.mockResolvedValue({ data: { user: { id: 'u1' } } })
    const res = await POST(req({ maintenanceCents: 100 }))
    expect(res.status).toBe(400)
    expect(sessionsCreate).not.toHaveBeenCalled()
  })

  it('creates a session for a signed-in user with a valid amount', async () => {
    getUser.mockResolvedValue({ data: { user: { id: 'u1' } } })
    sessionsCreate.mockResolvedValue({ url: 'https://checkout.stripe.test/s' })
    const res = await POST(req({ maintenanceCents: 7500 }))
    expect(res.status).toBe(200)
    expect(await res.json()).toEqual({ url: 'https://checkout.stripe.test/s' })
    // Expires an hour after creation (Aria, Oct 3 12:56), rounded down to the minute.
    const ttl = sessionsCreate.mock.calls[0][0].expires_at - Date.now() / 1000
    expect(ttl).toBeGreaterThan(58 * 60)
    expect(ttl).toBeLessThanOrEqual(3600)
  })
})
