import { fireEvent, render, screen, within } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'

/**
 * Sable 3:15 PM: the dashboard "Upcoming billing" reminder and the Plans renewal line are the SAME string
 * (same keys, same date format) for the same inputs, main line and gray carried line.
 */
const PERIOD_END = Math.floor(Date.now() / 1000) + 5 * 86400 - 600
const chain = (result: unknown) => {
  const c: Record<string, unknown> = {}
  for (const k of ['eq', 'order', 'limit', 'in', 'select']) c[k] = () => c
  c.single = async () => result
  c.maybeSingle = async () => result
  c.then = (ok: (v: unknown) => unknown) => Promise.resolve(result).then(ok)
  return c
}
vi.mock('@/lib/supabase/server', () => ({
  createClient: async () => ({
    auth: { getUser: async () => ({ data: { user: { id: 'u1' } } }) },
    from: (t: string) => chain(t === 'profiles' ? { data: { stripe_customer_id: 'cus_1', evaluation_status: 'none' } } : { data: [], count: 0 }),
  }),
}))
vi.mock('@/lib/stripe/server', () => ({
  getStripe: () => {
    const item = (lookup_key: string, name: string, unit_amount: number) => ({ price: { lookup_key, product: { id: `prod_${lookup_key}`, name }, unit_amount, recurring: { interval: 'month' } }, quantity: 1, current_period_end: PERIOD_END, current_period_start: PERIOD_END - 30 * 86400 })
    return {
      subscriptions: { list: async () => ({ data: [{ id: 'sub_r', status: 'active', created: 1790000000, cancel_at_period_end: false, items: { data: [item('freeplug_step_priority_monthly', 'Freeplug Hosting: Priority', 5500), item('freeplug_addon_big_change_monthly', 'Big change', 575)] } }] }) },
      invoices: { list: async () => ({ data: [] }), createPreview: async () => ({ object: 'invoice', amount_due: 7135, starting_balance: 35, total: 7100, currency: 'usd' }) },
      customers: { retrieve: async () => ({ id: 'cus_1', object: 'customer', balance: 35 }) },
    }
  },
}))

import { getEnhancedDashboardData } from './dashboard-actions'
import { DashboardAlerts } from './DashboardAlerts'
import { TipChangeBox } from '@/components/plans/TipChangeBox'
import { PLAN_STEPS } from '@/lib/plans/ladder'
import { formatPlanEndDate } from '@/lib/stripe/active-subscription'

describe('renewal line parity: dashboard reminder === Plans renewal line', () => {
  it('same total ($71.35, from the upcoming invoice), same date, same carried amount: identical main and gray lines', async () => {
    vi.spyOn(console, 'error').mockImplementation(() => undefined)
    const alert = (await getEnhancedDashboardData())!.alerts.find((a) => a.id === 'upcoming-billing')!
    const dash = render(<DashboardAlerts alerts={[alert]} />)
    const dashMain = within(dash.container).getByText(/^Your next bill will be/).textContent
    const dashGray = within(dash.container).getByTestId('alert-detail').textContent
    dash.unmount()

    // The Plans tip box, given the same inputs by its server action (nextDate = formatPlanEndDate of the period end).
    const step = PLAN_STEPS.find((s) => s.id === 'priority')!
    render(
      <TipChangeBox
        step={step}
        currentTipDollars={0}
        locked={false}
        onPreviewTip={async () => ({ ok: true, tipDollars: 1, nextAmountCents: 7135, nextDate: formatPlanEndDate(new Date(PERIOD_END * 1000)), confirmId: 'c-1', carriedCents: 35 })}
        onChangeTip={async () => ({ ok: true, message: '' })}
      />
    )
    const box = screen.getByTestId('tip-change-box')
    fireEvent.change(within(box).getByRole('slider'), { target: { value: String(step.monthlyCents / 100 + 1) } })
    fireEvent.click(within(box).getByTestId('tip-change-button'))
    const confirm = await within(box).findByTestId('tip-change-confirm')
    const plansMain = within(confirm).getByText(/^Your next bill will be/).textContent
    const plansGray = within(confirm).getByTestId('tip-change-carried').textContent

    expect(dashMain).toBe(`Your next bill will be $71.35 on ${formatPlanEndDate(new Date(PERIOD_END * 1000))}.`)
    expect(dashMain).toBe(plansMain)
    expect(dashGray).toBe('Includes $0.35 left from your last change.')
    expect(dashGray).toBe(plansGray)
  })
})
