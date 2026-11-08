// @vitest-environment node
import { describe, expect, it, vi } from 'vitest'
import { handleMerchCheckoutSessionCompleted } from './webhook'
import type Stripe from 'stripe'

vi.mock('./delivery', () => ({
  ensureMerchFontBundleToken: vi.fn(async () => ({
    token: 'plain-token',
    expiresAt: new Date().toISOString(),
    created: true,
  })),
  loadMerchTokenRow: vi.fn(async () => ({
    id: '1',
    stripe_checkout_session_id: 'cs_merch',
    emailed_at: null,
    expires_at: new Date(Date.now() + 60_000).toISOString(),
    revoked_at: null,
    download_count: 0,
    max_downloads: 5,
  })),
  revealMerchDownload: vi.fn(() => ({
    state: 'ready',
    token: 'plain-token',
    downloadUrl: 'https://example.test/dl',
    expiresAt: new Date().toISOString(),
    downloadCount: 0,
    maxDownloads: 5,
  })),
  trySendMerchDownloadEmailOnce: vi.fn(async () => 'sent'),
}))

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
