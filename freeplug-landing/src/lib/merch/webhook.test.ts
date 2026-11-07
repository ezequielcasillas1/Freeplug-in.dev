// @vitest-environment node
import { describe, expect, it, vi } from 'vitest'
import { handleMerchCheckoutSessionCompleted } from './webhook'
import type Stripe from 'stripe'

vi.mock('./email', () => ({
  sendMerchDownloadEmail: vi.fn(async () => ({ sent: true })),
  merchDownloadUrl: (t: string) => `https://example.test/dl?token=${t}`,
}))

vi.mock('./tokens', async (importOriginal) => {
  const actual = await importOriginal<typeof import('./tokens')>()
  return {
    ...actual,
    issueMerchFontBundleToken: vi.fn(async () => ({ token: 'plain-token', expiresAt: new Date().toISOString() })),
  }
})

describe('merch webhook', () => {
  it('skips non-merch sessions', async () => {
    const r = await handleMerchCheckoutSessionCompleted({} as never, {
      metadata: {},
      payment_status: 'paid',
    } as Stripe.Checkout.Session)
    expect(r).toBe('skipped')
  })

  it('handles merch font bundle session', async () => {
    const r = await handleMerchCheckoutSessionCompleted({} as never, {
      id: 'cs_merch',
      metadata: { checkout_type: 'merch_font_bundle' },
      payment_status: 'paid',
      customer_details: { email: 'a@b.com' },
    } as unknown as Stripe.Checkout.Session)
    expect(r).toBe('handled')
  })
})
