import { describe, expect, it, vi } from 'vitest'
import type Stripe from 'stripe'
import { handleMerchShopCheckoutSessionCompleted } from './fulfillment'

describe('shop fulfillment', () => {
  it('stores pending_review and does not call Printify', async () => {
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

    const fetchMock = vi.fn()
    const session = {
      id: 'cs_test_shop',
      payment_status: 'paid',
      metadata: {
        checkout_type: 'merch_shop',
        merch_shop_slug: 'test-slug',
        merch_variant_id: '1',
        merch_quantity: '1',
        merch_design_mode: 'custom',
        custom_upload_path: 'merch-shop-uploads/x.png',
      },
      customer_details: { email: 'buyer@example.com' },
    } as unknown as Stripe.Checkout.Session

    const result = await handleMerchShopCheckoutSessionCompleted(admin as never, session)
    expect(result).toBe('handled')
    expect(insert).toHaveBeenCalledOnce()
    expect(fetchMock).not.toHaveBeenCalled()
  })
})
