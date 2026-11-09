import { describe, expect, it, vi } from 'vitest'
import type Stripe from 'stripe'
import { handleMerchShirtCheckoutSessionCompleted } from './fulfillment'

const sessionBase = {
  id: 'cs_test_shirt',
  payment_status: 'paid',
  customer_email: 'buyer@example.com',
  metadata: {
    checkout_type: 'merch_shirt',
    product_slug: '03-get-plugged-in',
    shirt_color: 'Black',
    shirt_size: 'M',
    shirt_quantity: '1',
    printify_product_id: '6af0d0fe5dc84ade530368cf',
    printify_variant_id: '38178',
  },
  customer_details: {
    email: 'buyer@example.com',
    name: 'Ada Lovelace',
    address: {
      line1: '123 Main St',
      city: 'Austin',
      state: 'TX',
      postal_code: '78701',
      country: 'US',
    },
  },
  shipping_details: {
    name: 'Ada Lovelace',
    phone: '5125550100',
    address: {
      line1: '123 Main St',
      city: 'Austin',
      state: 'TX',
      postal_code: '78701',
      country: 'US',
    },
  },
} as unknown as Stripe.Checkout.Session

function makeAdmin(existing: { printify_order_id?: string | null } | null = null) {
  const rows = existing ? [{ ...existing, stripe_checkout_session_id: sessionBase.id }] : []
  return {
    from(table: string) {
      if (table !== 'merch_shirt_orders') throw new Error('wrong table')
      return {
        select() {
          return {
            eq(_c: string, id: string) {
              return {
                async maybeSingle() {
                  const row = rows.find((r) => (r as { stripe_checkout_session_id?: string }).stripe_checkout_session_id === id)
                  return { data: row ?? null, error: null }
                },
              }
            },
          }
        },
        insert(row: Record<string, unknown>) {
          rows.push({ ...row, stripe_checkout_session_id: sessionBase.id } as never)
          return {
            select() {
              return {
                async single() {
                  return { data: rows[rows.length - 1], error: null }
                },
              }
            },
          }
        },
        update(patch: Record<string, unknown>) {
          return {
            async eq(_c: string, id: string) {
              const row = rows.find((r) => (r as { stripe_checkout_session_id?: string }).stripe_checkout_session_id === id)
              if (row) Object.assign(row, patch)
              return { error: null }
            },
          }
        },
      }
    },
  }
}

vi.mock('@/lib/merch/email', () => ({
  sendMerchShirtOrderEmail: vi.fn().mockResolvedValue({ sent: true }),
}))

vi.mock('@/lib/email/mailer', () => ({
  sendMail: vi.fn().mockResolvedValue({ success: true }),
}))

describe('handleMerchShirtCheckoutSessionCompleted', () => {
  it('skips non-shirt sessions', async () => {
    const r = await handleMerchShirtCheckoutSessionCompleted(makeAdmin() as never, {
      id: 'cs_x',
      metadata: { checkout_type: 'merch_font_bundle' },
    } as unknown as Stripe.Checkout.Session)
    expect(r).toBe('skipped')
  })

  it('is idempotent when printify order already exists', async () => {
    vi.stubEnv('PRINTIFY_API_TOKEN', 'token')
    const fetch = vi.fn()
    const r = await handleMerchShirtCheckoutSessionCompleted(
      makeAdmin({ printify_order_id: 'pf_99' }) as never,
      sessionBase,
      { fetch }
    )
    expect(r).toBe('handled')
    expect(fetch).not.toHaveBeenCalled()
    vi.unstubAllEnvs()
  })

  it('creates Printify order with external_id = session id', async () => {
    vi.stubEnv('PRINTIFY_API_TOKEN', 'token')
    vi.stubEnv('PRINTIFY_SHOP_ID', '29664778')
    const fetch = vi.fn().mockResolvedValue({
      ok: true,
      text: async () => JSON.stringify({ id: 'pf_new' }),
    })
    const r = await handleMerchShirtCheckoutSessionCompleted(makeAdmin() as never, sessionBase, { fetch })
    expect(r).toBe('handled')
    expect(fetch).toHaveBeenCalledTimes(1)
    const [, init] = fetch.mock.calls[0] as [string, { body: string }]
    const body = JSON.parse(init.body)
    expect(body.external_id).toBe('cs_test_shirt')
    expect(body.line_items[0].variant_id).toBe(38178)
    vi.unstubAllEnvs()
  })

  it('throws when Printify fails so Stripe can retry', async () => {
    vi.stubEnv('PRINTIFY_API_TOKEN', 'token')
    const fetch = vi.fn().mockResolvedValue({ ok: false, status: 500, text: async () => 'err' })
    await expect(
      handleMerchShirtCheckoutSessionCompleted(makeAdmin() as never, sessionBase, { fetch })
    ).rejects.toThrow('printify_create_failed')
    vi.unstubAllEnvs()
  })
})
