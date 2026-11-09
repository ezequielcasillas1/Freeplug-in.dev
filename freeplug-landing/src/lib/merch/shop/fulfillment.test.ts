import { describe, expect, it, vi } from 'vitest'
import type Stripe from 'stripe'
import { handleMerchShopCheckoutSessionCompleted } from './fulfillment'

describe('shop fulfillment', () => {
  it('stores paid_cancellable for custom autosend metadata', async () => {
    const insert = vi.fn().mockResolvedValue({ error: null })
    const admin = {
      from: () => ({
        select: () => ({
          eq: () => ({
            maybeSingle: async () => ({ data: null, error: null }),
          }),
        }),
        insert,
      }),
    }

    const session = {
      id: 'cs_test_shop',
      payment_status: 'paid',
      payment_intent: 'pi_test',
      metadata: {
        checkout_type: 'merch_shop',
        merch_shop_slug: 'test-slug',
        merch_variant_id: '1',
        merch_quantity: '1',
        merch_design_mode: 'custom',
        custom_upload_path: 'merch-shop-uploads/x.png',
        shop_moderation_result: 'pass',
        rights_accepted_at: new Date().toISOString(),
      },
      customer_details: { email: 'buyer@example.com' },
    } as unknown as Stripe.Checkout.Session

    const prev = process.env.MERCH_CUSTOM_AUTOSEND_ENABLED
    process.env.MERCH_CUSTOM_AUTOSEND_ENABLED = 'true'
    const result = await handleMerchShopCheckoutSessionCompleted(admin as never, session)
    process.env.MERCH_CUSTOM_AUTOSEND_ENABLED = prev

    expect(result).toBe('handled')
    expect(insert).toHaveBeenCalledOnce()
    expect(insert.mock.calls[0][0].status).toBe('paid_cancellable')
  })
})
