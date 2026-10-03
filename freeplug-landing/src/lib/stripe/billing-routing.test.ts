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
