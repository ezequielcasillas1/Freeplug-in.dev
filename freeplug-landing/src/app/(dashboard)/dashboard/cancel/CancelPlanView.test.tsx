import { render, screen, within } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import type { CancelPageData, SubscriptionInfo } from './actions'
import { CANCEL_FAILED_MESSAGE, CANCEL_PLAN_BUTTON } from '@/lib/plans/ladder-copy'

vi.mock('next/link', () => ({
  default: ({ children, href, ...rest }: { children: React.ReactNode; href: string }) => (
    <a href={href} {...rest}>
      {children}
    </a>
  ),
}))
vi.mock('../billing-actions', () => ({ openBillingPortal: vi.fn(), resumePlan: vi.fn(), cancelHostingAtPeriodEnd: vi.fn() }))
vi.mock('../buyout-actions', () => ({ requestBuyoutQuote: vi.fn(async () => ({ ok: true, alreadyRequested: false })) }))

const { CancelPlanView } = await import('./CancelPlanView')

const END = new Date('2026-10-25T00:00:00Z')
const sub = (over: Partial<SubscriptionInfo> = {}): SubscriptionInfo => ({
  id: 'sub_1',
  status: 'active',
  productName: 'Hosting plan (monthly)',
  amount: 3500,
  interval: 'month',
  currentPeriodEnd: END,
  cancelAtPeriodEnd: false,
  canceledAt: null,
  ...over,
})
const data = (over: Partial<CancelPageData> = {}): CancelPageData => ({
  hasStripeCustomer: true,
  subscriptions: [],
  canceledSubscriptions: [],
  invoiceCount: 2,
  totalPaidCents: 7000,
  subscriptionsLoaded: true,
  ...over,
})

const OWNERSHIP = /website value|own it outright|Progress Toward Ownership|credited toward|no penalty|payment history are preserved|You Can Always Come Back/i

describe('CancelPlanView', () => {
  it('offline: "Bring your website back" with a "Restart hosting" link', () => {
    render(
      <CancelPlanView
        data={data({ canceledSubscriptions: [sub({ status: 'canceled', canceledAt: END })] })}
      />
    )
    expect(screen.getByRole('heading', { name: 'Bring your website back' })).toBeInTheDocument()
    expect(screen.getByRole('link', { name: 'Restart hosting →' })).toHaveAttribute('href', '/dashboard/plans')
    expect(screen.queryByText('Ready to resume?')).toBeNull()
    expect(screen.queryByText(/View plans to resume/)).toBeNull()
    // Keep card still offered to offline customers.
    expect(screen.getByTestId('buyout-card-cancel')).toBeInTheDocument()
    // "Bring your website back" covers it: no come-back box, no account summary.
    expect(screen.queryByText('Changed your mind later?')).toBeNull()
    expect(screen.queryByText(/Account Summary|Total Paid|Invoices Recorded/)).toBeNull()
  })

  it('ending: "Ready to resume?" (sentence case) and the Resume plan button', () => {
    render(<CancelPlanView data={data({ canceledSubscriptions: [sub({ cancelAtPeriodEnd: true })] })} />)
    expect(screen.getByRole('heading', { name: 'Ready to resume?' })).toBeInTheDocument()
    expect(screen.queryByText('Ready to Resume?')).toBeNull()
    expect(screen.getByRole('button', { name: 'Resume plan →' })).toBeInTheDocument()
    // Vera B3: the dashboard "Subscription ending" alert links here (/dashboard/cancel#resume-plan)
    expect(document.getElementById('resume-plan')).toContainElement(screen.getByRole('button', { name: 'Resume plan →' }))
    // Vera B1: the pending-aware submit (disabled while the form submits)
    expect(screen.getByRole('button', { name: 'Resume plan →' })).toHaveAttribute('data-testid', 'resume-plan-submit')
    expect(screen.getByTestId('buyout-card-cancel')).toBeInTheDocument()
    // "Ready to resume?" covers it: no come-back box, no account summary.
    expect(screen.queryByText('Changed your mind later?')).toBeNull()
    expect(screen.queryByText(/Account Summary|Total Paid|Invoices Recorded/)).toBeNull()
  })

  it('active plan plus a second plan set to end: come-back box hidden (a plan is canceled)', () => {
    render(
      <CancelPlanView
        data={data({ subscriptions: [sub()], canceledSubscriptions: [sub({ id: 'sub_2', cancelAtPeriodEnd: true })] })}
      />
    )
    expect(screen.queryByText('Changed your mind later?')).toBeNull()
  })

  it('active: Keep card replaces the ownership card; the warning stays right before the cancel button', () => {
    const { container } = render(<CancelPlanView data={data({ subscriptions: [sub()] })} />)
    expect(container.textContent).not.toMatch(OWNERSHIP)
    const keep = screen.getByTestId('buyout-card-cancel')
    expect(within(keep).getByText('Keep your website')).toBeInTheDocument()
    expect(
      within(keep).getByText(
        "Want to keep your website instead of hosting it with us? You can buy it for a one-time fee based on an estimate of its value. You'll see the exact price before you pay."
      )
    ).toBeInTheDocument()
    const warning = screen.getByTestId('cancel-access-warning')
    const cancelBtn = screen.getByRole('button', { name: CANCEL_PLAN_BUTTON })
    // Keep card comes before the warning; nothing but the warning between it and the button.
    expect(keep.compareDocumentPosition(warning) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy()
    expect(warning.nextElementSibling).toContainElement(cancelBtn)
    // Account summary (total paid, invoice count) removed (Sable, Sep 25 3:30 PM).
    expect(screen.queryByText('$70.00')).toBeNull()
    expect(screen.queryByText(/Account Summary|Total Paid|Invoices Recorded/)).toBeNull()
    // Come-back box: shown while active and not canceled, with Sable's locked text.
    expect(screen.getByText('Changed your mind later?')).toBeInTheDocument()
    expect(
      screen.getByText("If you cancel, you can come back. Sign up for hosting again, and we'll bring your website back.")
    ).toBeInTheDocument()
  })

  it('Vera bug 4: a tipped plan shows plan + tip = total (Sable TIP_TOTAL_LINE); no tip keeps "$35.00/month"', () => {
    const { unmount } = render(
      <CancelPlanView
        data={data({
          subscriptions: [sub({ productName: 'Freeplug Hosting: Fast lane', amount: 6500, tipCents: 600 })],
          canceledSubscriptions: [sub({ id: 'sub_2', productName: 'Freeplug Hosting: Fast lane', amount: 6500, tipCents: 200, cancelAtPeriodEnd: true })],
        })}
      />
    )
    expect(screen.getByText('$65.00 + $6.00 tip = $71.00/month')).toBeInTheDocument()
    expect(screen.getByText('$65.00 + $2.00 tip = $67.00/month')).toBeInTheDocument()
    expect(screen.queryByText('$65.00/month')).toBeNull()
    unmount()
    render(<CancelPlanView data={data({ subscriptions: [sub()] })} />)
    expect(screen.getByText('$35.00/month')).toBeInTheDocument()
  })

  it('Vera 5b: Starter + $11 reads "$35.00 + $11.00 tip = $46.00/month"', () => {
    render(<CancelPlanView data={data({ subscriptions: [sub({ productName: 'Freeplug Hosting: Starter', amount: 3500, tipCents: 1100 })] })} />)
    expect(screen.getByText('$35.00 + $11.00 tip = $46.00/month')).toBeInTheDocument()
    expect(screen.queryByText('$35.00/month')).toBeNull()
  })

  it('shows the thank-you line when a buyout request is already open', () => {
    render(<CancelPlanView data={data({ subscriptions: [sub()] })} buyoutRequested />)
    expect(screen.getByTestId('buyout-thanks')).toBeInTheDocument()
  })
})

// Round 12 (Vera r9 bugs 2 + 3): outreach customers get the dashboard's plan states on this page.
const FORBIDDEN = ['No Active Subscriptions', 'View available plans', 'Start with a website request', "You don't have any active hosting or maintenance plans."]
const LIVE_LINE = "Your site is live. We couldn't load your plan details right now. Refresh the page to try again, or email support@freeplug-in.dev."
const WAITING = "You already chose a hosting plan. You won't be charged until your site goes live."

describe('CancelPlanView for outreach customers (round 12)', () => {
  const noForbidden = (text: string | null) => FORBIDDEN.forEach((f) => expect(text ?? '').not.toContain(f))

  it('before Live, plan chosen: the plan-waiting message only (no cancel flow, no plans link)', () => {
    const { container } = render(<CancelPlanView data={data({ hasStripeCustomer: false })} outreachBox="plan_waiting" />)
    expect(screen.getByTestId('plan-waiting').textContent).toBe(WAITING)
    expect(screen.getByTestId('plan-waiting').className).toBe('text-gray-600')
    noForbidden(container.textContent)
    expect(screen.queryByRole('button', { name: CANCEL_PLAN_BUTTON })).toBeNull()
    expect(container.querySelector('a[href="/dashboard/plans"]')).toBeNull()
    expect(screen.queryByTestId('buyout-card-cancel')).toBeNull()
  })

  it('before Live, no plan chosen yet: the link back to the claim steps', () => {
    const { container } = render(<CancelPlanView data={data({ hasStripeCustomer: false })} outreachBox="choose_plan" />)
    expect(screen.getByTestId('choose-plan-link')).toHaveAttribute('href', '/claim')
    noForbidden(container.textContent)
  })

  it('after Live, no plan (no Stripe customer): Sable\'s 3:27 line, plain grey, no button or link in the box', () => {
    const { container } = render(<CancelPlanView data={data({ hasStripeCustomer: false })} outreachBox="plan_unavailable" />)
    const line = screen.getByTestId('plan-live-unavailable')
    expect(line.textContent).toBe(LIVE_LINE)
    expect(line.className).toBe('text-gray-600')
    const box = screen.getByTestId('cancel-outreach-plan')
    expect(box.querySelectorAll('a, button')).toHaveLength(0)
    expect(box.innerHTML).not.toMatch(/amber|red-|#ba3d3d/)
    noForbidden(container.textContent)
  })

  it('after Live, Stripe error: the same 3:27 line (lists empty, not loaded)', () => {
    const { container } = render(<CancelPlanView data={data({ subscriptionsLoaded: false })} outreachBox="plan_unavailable" />)
    expect(screen.getByTestId('plan-live-unavailable').textContent).toBe(LIVE_LINE)
    noForbidden(container.textContent)
  })

  it('after Live with a real plan: the existing cancel flow', () => {
    const { container } = render(<CancelPlanView data={data({ subscriptions: [sub()] })} outreachBox="plan" />)
    expect(screen.getByRole('button', { name: CANCEL_PLAN_BUTTON })).toBeInTheDocument()
    expect(screen.getByText('Your Active Services')).toBeInTheDocument()
    expect(screen.queryByTestId('cancel-outreach-plan')).toBeNull()
    noForbidden(container.textContent)
  })

  it('regular customer: unchanged (the "No Active Subscriptions" block with both variants)', () => {
    const { unmount } = render(<CancelPlanView data={data({ hasStripeCustomer: false })} />)
    expect(screen.getByText('No Active Subscriptions')).toBeInTheDocument()
    expect(screen.getByText('Start with a website request, then choose a hosting plan that fits your needs.')).toBeInTheDocument()
    expect(screen.getByRole('link', { name: 'View available plans →' })).toHaveAttribute('href', '/dashboard/plans')
    expect(screen.queryByTestId('cancel-outreach-plan')).toBeNull()
    unmount()
    render(<CancelPlanView data={data()} outreachBox={null} />)
    expect(screen.getByText("You don't have any active hosting or maintenance plans.")).toBeInTheDocument()
  })
})

// Round 12 additions (Lina / Sable 4:03 AM): same card as the dashboard, the before-Live help line,
// and no solid red button or cancel button unless there is a real plan.
describe('Cancel page outreach card (round 12, 4:03 AM)', () => {
  const HELP = "If you don't want to go ahead, email support@freeplug-in.dev and we'll help."
  const solidRedOrCancel = (root: HTMLElement) =>
    [...root.querySelectorAll('a, button')].filter(
      (el) => /(^|\s)bg-\[#ba3d3d\]/.test(el.getAttribute('class') ?? '') || /bg-red-|destructive/.test(el.getAttribute('class') ?? '') || /cancel/i.test(el.textContent ?? '')
    )

  it.each(['plan_waiting', 'choose_plan'] as const)('before Live (%s): Sable\'s 4:03 line in grey under the card line, email is a mailto link', (box) => {
    const { container } = render(<CancelPlanView data={data({ hasStripeCustomer: false })} outreachBox={box} />)
    const help = screen.getByTestId('cancel-before-live-help')
    expect(help.textContent).toBe(HELP)
    expect(help.className).toContain('text-gray-600')
    const mail = screen.getByTestId('cancel-support-mailto')
    expect(mail.getAttribute('href')).toBe('mailto:support@freeplug-in.dev')
    expect(mail.textContent).toBe('support@freeplug-in.dev')
    // 44px tap target: 12px padding top and bottom around the 20px line, no layout shift.
    expect(mail.className.split(/\s+/)).toEqual(expect.arrayContaining(['inline-block', 'py-3', '-my-3']))
    // Inside the same card, after the plan line.
    const card = screen.getByTestId('outreach-plan-card')
    expect(card).toContainElement(help)
    expect(solidRedOrCancel(container)).toEqual([])
  })

  it('after Live with no plan or a Stripe error: the 3:27 line only, no help line, no red or cancel button', () => {
    for (const d of [data({ hasStripeCustomer: false }), data({ subscriptionsLoaded: false })]) {
      const { container, unmount } = render(<CancelPlanView data={d} outreachBox="plan_unavailable" />)
      expect(screen.queryByTestId('cancel-before-live-help')).toBeNull()
      expect(screen.getByTestId('plan-live-unavailable')).toBeInTheDocument()
      expect(solidRedOrCancel(container)).toEqual([])
      unmount()
    }
  })

  it('with a real plan: the normal cancel flow (its cancel button) is back, no outreach card', () => {
    render(<CancelPlanView data={data({ subscriptions: [sub()] })} outreachBox="plan" />)
    expect(screen.getByRole('button', { name: CANCEL_PLAN_BUTTON })).toBeInTheDocument()
    expect(screen.queryByTestId('outreach-plan-card')).toBeNull()
  })

  it('a pending downgrade: cancel happens in the app (it also cancels the switch), not in the billing portal', () => {
    render(<CancelPlanView data={data({ subscriptions: [sub({ pendingChange: { stepName: 'Priority', effectiveAt: new Date('2026-11-03T17:14:00Z') } })] })} />)
    expect(screen.getByTestId('cancel-pending-note')).toHaveTextContent('You have a switch to Priority planned for Nov 3, 2026. Canceling your plan also cancels that switch.')
    expect(screen.getByRole('button', { name: 'Cancel my plan at the end of this billing period' })).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: /billing portal/i })).toBeNull()
  })
})

describe('cancel goes only through the app (Aria, Oct 3 4:05 PM)', () => {
  it('no billing-portal cancel anywhere; the in-app cancel button with or without a pending switch', () => {
    const { unmount } = render(<CancelPlanView data={data({ subscriptions: [sub()] })} />)
    expect(screen.getByRole('button', { name: CANCEL_PLAN_BUTTON })).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: /billing portal/i })).toBeNull()
    unmount()
    render(<CancelPlanView data={data({ subscriptions: [sub({ pendingChange: { stepName: 'Priority', effectiveAt: new Date('2026-11-03T17:14:00Z') } })] })} />)
    expect(screen.getByRole('button', { name: CANCEL_PLAN_BUTTON })).toBeInTheDocument()
    expect(screen.getByTestId('cancel-pending-note')).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: /billing portal/i })).toBeNull()
  })
  it('?cancel_error=1: the failure line with the support contact', () => {
    render(<CancelPlanView data={data({ subscriptions: [sub()] })} cancelError />)
    expect(screen.getByTestId('cancel-error')).toHaveTextContent(CANCEL_FAILED_MESSAGE)
    expect(CANCEL_FAILED_MESSAGE).toContain('support@freeplug-in.dev')
    expect(CANCEL_FAILED_MESSAGE).toContain('737-392-5612')
  })
})

describe('cancel page plan card heading (Sable 5:23 PM)', () => {
  it('a ladder plan reads "Fast lane" (plan name only), active or set to end', () => {
    const fl = { productName: 'Freeplug Hosting: Fast lane', planName: 'Fast lane', amount: 6500, tipCents: 400 }
    const { unmount } = render(<CancelPlanView data={data({ subscriptions: [sub(fl)] })} />)
    expect(screen.getByRole('heading', { name: 'Fast lane' })).toBeInTheDocument()
    expect(document.body).not.toHaveTextContent('Freeplug Hosting:')
    unmount()
    render(<CancelPlanView data={data({ canceledSubscriptions: [sub({ ...fl, cancelAtPeriodEnd: true })] })} />)
    expect(screen.getByRole('heading', { name: 'Fast lane' })).toBeInTheDocument()
    expect(document.body).not.toHaveTextContent('Freeplug Hosting:')
  })
  it('a grandfathered plan keeps its product name', () => {
    render(<CancelPlanView data={data({ subscriptions: [sub({ planName: 'Hosting plan (monthly)' })] })} />)
    expect(screen.getByRole('heading', { name: 'Hosting plan (monthly)' })).toBeInTheDocument()
  })
})
