/**
 * Plans page billing (Aria, Oct 3 12:56): Manage billing lands here while a switch is planned
 * (?billing=pending shows the notice with the step and date), and the Billing section (Update card +
 * in-app invoice list) is there with or without a schedule.
 */
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { render, screen, within } from '@testing-library/react'

let schedule: string | null = null
let invoicesFail = false
vi.mock('@/lib/supabase/server', () => ({
  createClient: async () => ({
    auth: { getUser: async () => ({ data: { user: { id: 'u1' } } }) },
    from: () => ({ select: () => ({ eq: () => ({ single: async () => ({ data: { stripe_customer_id: 'cus_1' }, error: null }) }) }) }),
  }),
}))
vi.mock('@/lib/dashboard/plans-eligibility', () => ({ isPlansCheckoutAllowed: async () => true }))
vi.mock('@/lib/stripe/active-subscription', async (orig) => ({
  ...(await orig<typeof import('@/lib/stripe/active-subscription')>()),
  describeLiveSubscriptions: async () => ['Freeplug Hosting: Fast lane · $65.00/month'],
  listLiveSubscriptions: async () => [{ id: 'sub_1', status: 'active', schedule }],
}))
vi.mock('@/lib/plans/user-entitlements', async () => {
  const { entitlementsFor } = await import('@/lib/plans/ladder')
  return { getUserEntitlements: async () => ({ entitlements: entitlementsFor({ stepId: 'fast_lane' }), source: 'snapshot' }) }
})
vi.mock('@/lib/stripe/change-plan', () => ({
  pendingPlanChange: async (_s: unknown, sub: { schedule: string | null }) =>
    sub.schedule ? { step: 'starter', effectiveAt: '2026-11-03T17:48:16.000Z', scheduleId: sub.schedule } : null,
}))
vi.mock('@/lib/stripe/server', () => ({
  getStripe: () => ({
    invoices: {
      list: async () => {
        if (invoicesFail) throw new Error('down')
        return { data: [{ id: 'in_1', status: 'paid', number: 'A-1', created: 1_790_000_000, total: 6500, currency: 'usd', hosted_invoice_url: 'https://invoice.stripe.test/in_1', invoice_pdf: 'https://pdf.stripe.test/in_1' }] }
      },
    },
  }),
}))
vi.mock('../billing-actions', () => ({
  changeHostingPlan: vi.fn(),
  updatePaymentMethod: vi.fn(),
  openBillingPortal: vi.fn(),
}))
vi.mock('@/app/(dashboard)/dashboard/billing-actions', () => ({
  changeHostingPlan: vi.fn(),
  updatePaymentMethod: vi.fn(),
  openBillingPortal: vi.fn(),
}))

import DashboardPlansPage from './page'

const renderPage = async (params: Record<string, string> = {}) =>
  render(await DashboardPlansPage({ searchParams: Promise.resolve(params) }))

describe('Plans page billing', () => {
  beforeEach(() => {
    schedule = null
    invoicesFail = false
  })

  it('with a schedule, from Manage billing: the pending-change notice with step and date, plus Billing', async () => {
    schedule = 'sub_sched_1'
    await renderPage({ billing: 'pending' })
    expect(screen.getByTestId('billing-pending-notice').textContent).toBe(
      'You have a switch to Starter planned for November 3, 2026, so billing is handled here until then. You can update your card and see your invoices below.'
    )
    expect(screen.getByText(/Changing to Starter on November 3, 2026/)).toBeTruthy()
    const billing = screen.getByTestId('billing-tools')
    expect(within(billing).getByRole('button', { name: 'Update card' })).toBeTruthy()
    expect(within(billing).getByRole('link', { name: 'View' }).getAttribute('href')).toBe('https://invoice.stripe.test/in_1')
    expect(within(billing).getByText('$65.00')).toBeTruthy()
  })

  it('without a schedule: no notice, Billing (card + invoices) still there', async () => {
    await renderPage({ billing: 'pending' })
    expect(screen.queryByTestId('billing-pending-notice')).toBeNull()
    expect(within(screen.getByTestId('billing-tools')).getByRole('button', { name: 'Update card' })).toBeTruthy()
    expect(screen.getByTestId('invoice-list')).toBeTruthy()
  })

  it('card flow return and an unreachable invoice list', async () => {
    invoicesFail = true
    await renderPage({ card: 'updated' })
    expect(screen.getByTestId('card-updated')).toBeTruthy()
    expect(screen.queryByTestId('invoice-list')).toBeNull()
    expect(screen.getByRole('button', { name: 'Update card' })).toBeTruthy()
  })
})
