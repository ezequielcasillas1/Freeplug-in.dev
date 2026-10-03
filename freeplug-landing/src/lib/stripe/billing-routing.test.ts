// @vitest-environment node
import { describe, expect, it } from 'vitest'
import { findScheduledSubscription, listInvoicesForCustomer, paymentMethodUpdateSessionParams } from './billing-routing'

const subs = (data: unknown[]) => ({ subscriptions: { list: async () => ({ data }) } }) as never

describe('findScheduledSubscription', () => {
  it('null without a schedule', async () => {
    expect(await findScheduledSubscription(subs([{ id: 'sub_1', status: 'active', schedule: null }]), 'cus_1')).toBeNull()
  })
  it('finds the live subscription a schedule manages (string or expanded)', async () => {
    expect(await findScheduledSubscription(subs([{ id: 'sub_1', status: 'active', schedule: 'sub_sched_1' }]), 'cus_1')).toEqual({ subscriptionId: 'sub_1', scheduleId: 'sub_sched_1' })
    expect(await findScheduledSubscription(subs([{ id: 'sub_2', status: 'past_due', schedule: { id: 'sub_sched_2' } }]), 'cus_1')).toEqual({ subscriptionId: 'sub_2', scheduleId: 'sub_sched_2' })
  })
  it('ignores ended subscriptions', async () => {
    expect(await findScheduledSubscription(subs([{ id: 'sub_1', status: 'canceled', schedule: 'sub_sched_1' }]), 'cus_1')).toBeNull()
  })
})

describe('paymentMethodUpdateSessionParams', () => {
  it('card-only flow with an after-completion redirect, using the ladder portal configuration when set', () => {
    expect(paymentMethodUpdateSessionParams('cus_1', 'https://x/plans?card=updated', { STRIPE_PORTAL_CONFIGURATION_ID: 'bpc_123' })).toEqual({
      customer: 'cus_1',
      return_url: 'https://x/plans?card=updated',
      configuration: 'bpc_123',
      flow_data: { type: 'payment_method_update', after_completion: { type: 'redirect', redirect: { return_url: 'https://x/plans?card=updated' } } },
    })
  })
})

describe('listInvoicesForCustomer (in-app invoice list)', () => {
  it('newest first as Stripe returns them; drafts and voided invoices left out', async () => {
    const inv = (id: string, status: string) => ({ id, status, number: `N-${id}`, created: 1_790_000_000, total: 6500, currency: 'usd', hosted_invoice_url: `https://invoice.stripe.test/${id}`, invoice_pdf: `https://pdf.stripe.test/${id}` })
    const calls: unknown[] = []
    const list = async (q: unknown) => (calls.push(q), ({ data: [inv('in_1', 'paid'), inv('in_2', 'void'), inv('in_3', 'draft'), inv('in_4', 'open'), inv('in_5', 'uncollectible')] }))
    const rows = await listInvoicesForCustomer({ invoices: { list } } as never, 'cus_1')
    expect(calls).toEqual([{ customer: 'cus_1', limit: 12 }])
    expect(rows.map((r) => [r.id, r.status])).toEqual([['in_1', 'paid'], ['in_4', 'open'], ['in_5', 'uncollectible']])
    expect(rows[0]).toMatchObject({ number: 'N-in_1', totalCents: 6500, currency: 'usd', hostedUrl: 'https://invoice.stripe.test/in_1', pdfUrl: 'https://pdf.stripe.test/in_1', created: new Date(1_790_000_000_000).toISOString() })
  })
})

describe('listInvoicesForCustomer: the tip as its own amount (round 5b)', () => {
  const line = (amount: number, product: string) => ({ amount, pricing: { price_details: { product, price: `price_${product}` } } })
  const inv = (id: string, total: number, lines: unknown[]) => ({ id, status: 'paid', number: id, created: 1_790_000_000, total, currency: 'usd', hosted_invoice_url: null, invoice_pdf: null, lines: { data: lines } })
  it('tipCents from the tip price lines; 0 without one; a tip credit (upgrade proration) is not shown as a tip', async () => {
    const list = async () => ({
      data: [
        inv('in_tip', 7000, [line(6500, 'freeplug_step_fast_lane'), line(500, 'freeplug_tip')]),
        inv('in_plain', 6500, [line(6500, 'freeplug_step_fast_lane')]),
        inv('in_upgrade', 600, [line(-3000, 'freeplug_step_priority'), line(-200, 'freeplug_tip'), line(3800, 'freeplug_step_fast_lane')]),
      ],
    })
    const rows = await listInvoicesForCustomer({ invoices: { list } } as never, 'cus_1')
    expect(rows.map((r) => [r.id, r.totalCents, r.tipCents])).toEqual([
      ['in_tip', 7000, 500],
      ['in_plain', 6500, 0],
      ['in_upgrade', 600, 0],
    ])
  })
})
