// @vitest-environment node
import Stripe from 'stripe'
import { describe, expect, it } from 'vitest'

// The real stripe library, offline (dummy key, no API calls): the async verifier the webhook now
// uses accepts a correctly signed payload and rejects a tampered one. On Workers only the async
// path works, because Web Crypto is async.
describe('stripe.webhooks.constructEventAsync (no network)', () => {
  const stripe = new Stripe('sk_test_dummy_not_a_real_key')
  const secret = 'whsec_local_test_only'
  const payload = JSON.stringify({ id: 'evt_local', object: 'event', type: 'invoice.paid', data: { object: {} } })

  it('accepts a valid signature and rejects a tampered body or wrong secret', async () => {
    const header = await stripe.webhooks.generateTestHeaderStringAsync({ payload, secret })
    const event = await stripe.webhooks.constructEventAsync(payload, header, secret)
    expect(event.id).toBe('evt_local')
    await expect(stripe.webhooks.constructEventAsync(payload.replace('invoice', 'invoicX'), header, secret)).rejects.toThrow()
    await expect(stripe.webhooks.constructEventAsync(payload, header, 'whsec_other')).rejects.toThrow()
  })
})
