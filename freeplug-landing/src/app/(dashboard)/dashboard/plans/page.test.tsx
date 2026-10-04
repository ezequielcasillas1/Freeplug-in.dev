/**
 * Plans page billing (Aria, Oct 3 12:56): Manage billing lands here while a switch is planned
 * (?billing=pending shows the notice with the step and date), and the Billing section (Update card +
 * in-app invoice list) is there with or without a schedule.
 */
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { render, screen, within } from '@testing-library/react'

let schedule: string | null = null
/** What the schedule holds: a step switch (default) or only add-ons that end (Oct 4). */
let pendingKind: 'switch' | 'addons' = 'switch'
let liveAddonIds: string[] = []
let invoicesFail = false
vi.mock('@/lib/supabase/server', () => ({
  createClient: async () => ({
    auth: { getUser: async () => ({ data: { user: { id: 'u1' } } }) },
    from: () => ({ select: () => ({ eq: () => ({ single: async () => ({ data: { stripe_customer_id: 'cus_1' }, error: null }) }) }) }),
  }),
}))
/** Aria 10:09: open owed removals from a failed resume (addon_removals_owed); [] once the removal finishes. */
let owedAddons: string[] = []
const owedReads: string[][] = []
vi.mock('@/lib/stripe/addon-removal-owed-server', () => ({
  resumeRemovalOwed: async (ids: string[]) => (owedReads.push([...ids]), { addons: owedAddons, effectiveAt: owedAddons.length ? '2026-11-03T17:48:16.000Z' : null }),
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
  subscriptionAddons: () => ({ ids: liveAddonIds, cents: 0 }),
  pendingPlanChange: async (_s: unknown, sub: { schedule: string | null }) =>
    sub.schedule
      ? pendingKind === 'switch'
        ? { step: 'starter', effectiveAt: '2026-11-03T17:48:16.000Z', scheduleId: sub.schedule, isSwitch: true, removedAddons: [] }
        : { step: 'fast_lane', effectiveAt: '2026-11-03T17:48:16.000Z', scheduleId: sub.schedule, isSwitch: false, removedAddons: ['big_change'] }
      : null,
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
  previewAddonChangeAction: vi.fn(),
  changeAddonAction: vi.fn(),
}))
vi.mock('@/app/(dashboard)/dashboard/billing-actions', () => ({
  changeHostingPlan: vi.fn(),
  previewPlanChange: vi.fn(),
  updatePaymentMethod: vi.fn(),
  openBillingPortal: vi.fn(),
  previewTipChangeAction: vi.fn(),
  changeTipAction: vi.fn(),
  previewAddonChangeAction: vi.fn(),
  changeAddonAction: vi.fn(),
}))

import DashboardPlansPage from './page'
import { formatShortPlanDate } from '@/lib/stripe/active-subscription'

const renderPage = async (params: Record<string, string> = {}) =>
  render(await DashboardPlansPage({ searchParams: Promise.resolve(params) }))

describe('Plans page billing', () => {
  beforeEach(() => {
    schedule = null
    pendingKind = 'switch'
    liveAddonIds = []
    invoicesFail = false
    owedAddons = []
    owedReads.length = 0
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

  it('add-ons (Oct 4): a schedule that only ends an add-on is not a plan change; the card says when it ends', async () => {
    schedule = 'sub_sched_1'
    pendingKind = 'addons'
    liveAddonIds = ['small_edit', 'big_change']
    render(await DashboardPlansPage({ searchParams: Promise.resolve({}) }))
    expect(screen.queryByTestId('pending-change')).toBeNull()
    expect(screen.getByTestId('addons-block')).toBeInTheDocument()
    expect(screen.getByTestId('addon-switch-small_edit')).toHaveAttribute('aria-checked', 'true')
    expect(screen.getByTestId('addon-ending')).toHaveTextContent('Ends November 3, 2026')
    expect(screen.getByTestId('addon-keep-big_change')).toBeInTheDocument()
  })
})

describe('Aria 10:09 (option A), Lina: Resume worked but an add-on removal is still owed', () => {
  const STATUS = "Your plan is back on. We're still turning off Big change. If it's charged before that's done, we'll refund it."
  let scrolled: Element[] = []
  beforeEach(() => {
    schedule = null
    pendingKind = 'switch'
    liveAddonIds = ['small_edit', 'big_change']
    invoicesFail = false
    owedAddons = []
    owedReads.length = 0
    scrolled = []
    Element.prototype.scrollIntoView = function (this: Element) {
      scrolled.push(this)
    } as Element['scrollIntoView']
  })

  it('the exact status in the amber pending-switch box at the TOP of the Plans card (not a red error, not a toast)', async () => {
    owedAddons = ['big_change']
    const { container } = await renderPage({ hosting: 'resumed' })
    const box = screen.getByTestId('removal-owed')
    expect(box.textContent).toBe(STATUS)
    expect(owedReads).toEqual([['sub_1']])
    // the pending-switch box style (amber), a status, never an alert / red error
    expect(box).toHaveAttribute('role', 'status')
    expect(box.className).toContain('border-amber-200')
    expect(box.className).toContain('bg-amber-50')
    expect(box.className).toContain('text-amber-950')
    expect(box.className).not.toMatch(/red|destructive/)
    expect(screen.queryByRole('alert')).toBeNull()
    expect(box.closest('[role="alertdialog"], [data-sonner-toast], [data-toast]')).toBeNull()
    // top of the Plans card: its first child, above the plan strip
    const strip = screen.getByTestId('plan-strip')
    expect(box.parentElement).toBe(strip.parentElement)
    expect(box.parentElement!.firstElementChild).toBe(box)
    expect(container.querySelector('[data-testid="removal-owed"] ~ [data-testid="plan-strip"]')).toBe(strip)
    // shown on arrival, not focused or scrolled (that is the second click)
    expect(document.activeElement).not.toBe(box)
    expect(scrolled).toEqual([])
  })

  it('it stays until the removal finishes: any later visit (no params) still shows it; once the owed row is cleared it is gone', async () => {
    owedAddons = ['big_change']
    const first = await renderPage()
    expect(screen.getByTestId('removal-owed').textContent).toBe(STATUS)
    first.unmount()
    const again = await renderPage({ billing: 'pending' })
    expect(screen.getByTestId('removal-owed').textContent).toBe(STATUS)
    again.unmount()
    owedAddons = [] // the renewal removed it (refunded or not billed) and cleared the flag
    await renderPage({ hosting: 'resumed' })
    expect(screen.queryByTestId('removal-owed')).toBeNull()
  })

  it('a second Resume click (focus=removal-owed): the box is scrolled into view and gets focus', async () => {
    owedAddons = ['big_change']
    await renderPage({ hosting: 'resumed', focus: 'removal-owed' })
    const box = screen.getByTestId('removal-owed')
    expect(box).toHaveAttribute('id', 'removal-owed')
    expect(box).toHaveAttribute('tabindex', '-1')
    expect(scrolled).toEqual([box])
    expect(document.activeElement).toBe(box)
  })

  it('both add-ons owed: one sentence with both names', async () => {
    owedAddons = ['small_edit', 'big_change']
    await renderPage()
    expect(screen.getByTestId('removal-owed').textContent).toBe("Your plan is back on. We're still turning off +1 small edit and Big change. If it's charged before that's done, we'll refund it.")
  })
})
