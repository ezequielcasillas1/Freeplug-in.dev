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
  describeLiveSubscriptions: async () => ['Fast lane · $65/month'],
  listLiveSubscriptions: async () => [{ id: 'sub_1', status: 'active', schedule, items: { data: [{ id: 'si_1', current_period_end: 1_793_726_896, price: { id: 'price_fast_lane', unit_amount: 6500, recurring: { interval: 'month' } } }] } }],
}))
vi.mock('@/lib/plans/user-entitlements', async () => {
  const { entitlementsFor } = await import('@/lib/plans/ladder')
  return { getUserEntitlements: async () => ({ entitlements: entitlementsFor({ stepId: 'fast_lane' }), source: 'snapshot' }) }
})
vi.mock('@/lib/stripe/change-plan', () => ({
  subscriptionMonthlyCents: () => 6500,
  subscriptionTipDollars: (sub: { tip?: number }) => sub.tip ?? 0,
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
  previewPlanChange: vi.fn(),
  updatePaymentMethod: vi.fn(),
  openBillingPortal: vi.fn(),
  previewTipChangeAction: vi.fn(),
  changeTipAction: vi.fn(),
}))
vi.mock('@/app/(dashboard)/dashboard/billing-actions', () => ({
  changeHostingPlan: vi.fn(),
  previewPlanChange: vi.fn(),
  updatePaymentMethod: vi.fn(),
  openBillingPortal: vi.fn(),
  previewTipChangeAction: vi.fn(),
  changeTipAction: vi.fn(),
}))

import DashboardPlansPage from './page'
import { formatShortPlanDate } from '@/lib/stripe/active-subscription'

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

  it('Lina §1/§3a layout: plan strip and pending box above the list, Keep in the box, no Manage billing while pending, Maintenance below', async () => {
    schedule = 'sub_sched_1'
    const { container } = await renderPage()
    const strip = screen.getByTestId('plan-strip')
    expect(strip.textContent).toContain('Current plan: Fast lane · $65/month')
    expect(strip.textContent).not.toMatch(/Current plan: [^·]*:/)
    const box = within(strip).getByTestId('pending-change')
    expect(within(box).getByRole('button', { name: 'Keep Fast lane' })).toBeTruthy()
    const list = container.querySelector('[data-plan-step="starter"]') as HTMLElement
    expect(strip.compareDocumentPosition(list) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy()
    expect(within(list).getByTestId('starts-badge').textContent).toBe('Starts November 3, 2026')
    expect(screen.queryByRole('button', { name: 'Manage billing' })).toBeNull()
    // selected = current: the main button only ever means "switch"
    expect(screen.getByRole('button', { name: 'Choose a different plan to switch' })).toBeDisabled()
    const maintenance = screen.getByText(/One-time maintenance/)
    expect(list.compareDocumentPosition(maintenance) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy()
  })

  it('no pending change: Manage billing (secondary) is back, and a lower step says "on <short next billing date>"', async () => {
    const { container } = await renderPage()
    expect(screen.getByRole('button', { name: 'Manage billing' })).toBeTruthy()
    const starter = container.querySelector('[data-plan-step="starter"] input') as HTMLInputElement
    starter.click()
    // Lina, round 5b: short date on the button only ("Nov 3"; the year only when it isn't this year).
    const short = formatShortPlanDate(new Date('2026-11-03T00:00:00Z'))
    expect(short).toBe(new Date().getUTCFullYear() === 2026 ? 'Nov 3' : 'Nov 3, 2026')
    expect(await screen.findByRole('button', { name: `Switch to Starter on ${short}` })).toBeEnabled()
  })
})
