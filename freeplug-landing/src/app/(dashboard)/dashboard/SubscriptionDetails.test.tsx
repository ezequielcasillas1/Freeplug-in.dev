import { render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { SubscriptionDetails } from './SubscriptionDetails'
import type { SubscriptionDetail } from './dashboard-actions'
import { cumulativePerks, entitlementsFor } from '@/lib/plans/ladder'
import { INCLUDED_EDIT_LINE, LEGACY_PLAN_LABEL, PERK_LINES } from '@/lib/plans/ladder-copy'

const LINE = 'Priority included: your change requests go to the front of our queue.'

function plan(amount: number): SubscriptionDetail {
  return {
    id: 'sub_1',
    productName: 'Hosting plan (monthly) + Pro add-on (monthly)',
    status: 'active',
    amount,
    interval: 'month',
    currentPeriodEnd: new Date('2026-10-25T00:00:00Z'),
    currentPeriodStart: new Date('2026-09-25T00:00:00Z'),
    cancelAtPeriodEnd: false,
    created: new Date('2026-09-25T00:00:00Z'),
  }
}

describe('SubscriptionDetails Priority line', () => {
  it('shows Priority at $55/month', () => {
    render(<SubscriptionDetails subscriptions={[plan(5500)]} />)
    expect(screen.getByText(LINE)).toBeInTheDocument()
  })

  it('does not show Priority at $50/month', () => {
    render(<SubscriptionDetails subscriptions={[plan(5000)]} />)
    expect(screen.queryByText(LINE)).toBeNull()
  })
})

describe('SubscriptionDetails renewal date', () => {
  it('shows the renewal date', () => {
    render(<SubscriptionDetails subscriptions={[plan(3500)]} />)
    expect(screen.getByText('Renews: Oct 25, 2026')).toBeInTheDocument()
  })

  it('shows a fallback instead of "Invalid Date" when Stripe sends no period end', () => {
    render(
      <SubscriptionDetails subscriptions={[{ ...plan(3500), currentPeriodEnd: null }]} />
    )
    expect(screen.getByText('Renews: Date not available')).toBeInTheDocument()
    expect(screen.queryByText(/Invalid Date/)).toBeNull()
  })
})

describe('SubscriptionDetails "View available plans" (Lina, Sep 25)', () => {
  const canceled: SubscriptionDetail = { ...plan(3500), status: 'canceled' }
  it('hidden in the offline state ("Restart hosting" in the access alert covers it)', () => {
    render(
      <SubscriptionDetails
        subscriptions={[canceled]}
        websiteAccess={{ status: 'offline', accessEndsAt: null, hasHostingHistory: true }}
      />
    )
    expect(screen.getByText('No active subscriptions.')).toBeInTheDocument()
    expect(screen.queryByText('View available plans')).toBeNull()
  })

  it('still shown for a customer who never had hosting (no access alert)', () => {
    render(
      <SubscriptionDetails
        subscriptions={[]}
        websiteAccess={{ status: 'offline', accessEndsAt: null, hasHostingHistory: false }}
      />
    )
    expect(screen.getByText('View available plans')).toBeInTheDocument()
  })

  it('still shown when access is unknown', () => {
    render(<SubscriptionDetails subscriptions={[]} />)
    expect(screen.getByText('View available plans')).toBeInTheDocument()
  })
})

describe('SubscriptionDetails for a claimed outreach customer (Lina / Sable, Sep 27, round 9)', () => {
  const WAITING = "You already chose a hosting plan. You won't be charged until your site goes live."
  const LIVE_NO_PLAN =
    "Your site is live. We couldn't load your plan details right now. Refresh the page to try again, or email support@freeplug-in.dev."
  const noEmptyState = () => {
    expect(screen.queryByText('No active subscriptions.')).toBeNull()
    expect(screen.queryByText('View available plans')).toBeNull()
  }

  it('before billing (plan chosen, not live): the plan-waiting message, never the empty state', () => {
    render(<SubscriptionDetails subscriptions={[]} outreach={{ box: 'plan_waiting' }} />)
    expect(screen.getByTestId('plan-waiting')).toHaveTextContent(WAITING)
    expect(screen.queryByText(LIVE_NO_PLAN)).toBeNull()
    noEmptyState()
  })

  it('before billing, even if a subscription somehow exists: still the plan-waiting message', () => {
    render(<SubscriptionDetails subscriptions={[plan(3500)]} outreach={{ box: 'plan_waiting' }} />)
    expect(screen.getByTestId('plan-waiting')).toHaveTextContent(WAITING)
    expect(screen.queryByText('Hosting plan (monthly) + Pro add-on (monthly)')).toBeNull()
    noEmptyState()
  })

  it('no plan chosen yet: a link back to the claim steps, still no "View available plans"', () => {
    render(<SubscriptionDetails subscriptions={[]} outreach={{ box: 'choose_plan' }} />)
    expect(screen.getByRole('link', { name: /Choose your hosting plan/ })).toHaveAttribute('href', '/claim')
    noEmptyState()
  })

  it('live with a real subscription: their real plan', () => {
    render(<SubscriptionDetails subscriptions={[plan(3500)]} outreach={{ box: 'plan' }} />)
    expect(screen.getByText('Hosting plan (monthly) + Pro add-on (monthly)')).toBeInTheDocument()
    expect(screen.getByText('$35.00/month')).toBeInTheDocument()
    expect(screen.queryByText(WAITING)).toBeNull()
    expect(screen.queryByText(LIVE_NO_PLAN)).toBeNull()
  })

  it("live but the plan can't be loaded: Sable's 3:27 line as plain grey text, no button, no amber or red", () => {
    render(<SubscriptionDetails subscriptions={[]} outreach={{ box: 'plan_unavailable' }} />)
    const line = screen.getByTestId('plan-live-unavailable')
    expect(line).toHaveTextContent(LIVE_NO_PLAN)
    expect(line.tagName).toBe('P')
    expect(line.className).toBe('text-gray-600')
    const box = line.closest('.rounded-xl') as HTMLElement
    expect(box.querySelectorAll('a, button')).toHaveLength(0)
    expect(box.innerHTML).not.toMatch(/amber|red-|#ba3d3d/)
    expect(screen.queryByText(WAITING)).toBeNull()
    noEmptyState()
  })

  it("live, box says 'plan' but no active subscription arrived: falls back to the 3:27 line", () => {
    const canceled = { ...plan(3500), status: 'canceled' as const }
    render(<SubscriptionDetails subscriptions={[canceled]} outreach={{ box: 'plan' }} />)
    expect(screen.getByTestId('plan-live-unavailable')).toHaveTextContent(LIVE_NO_PLAN)
    noEmptyState()
  })

  it('non-outreach customer with no subscription is unchanged', () => {
    render(<SubscriptionDetails subscriptions={[]} outreach={null} />)
    expect(screen.getByText('No active subscriptions.')).toBeInTheDocument()
    expect(screen.getByText('View available plans')).toBeInTheDocument()
    expect(screen.queryByText(WAITING)).toBeNull()
    expect(screen.queryByText(LIVE_NO_PLAN)).toBeNull()
  })

  it('non-outreach customer with an active subscription: the normal list (unchanged)', () => {
    render(<SubscriptionDetails subscriptions={[plan(3500)]} outreach={null} />)
    expect(screen.getByText('Hosting plan (monthly) + Pro add-on (monthly)')).toBeInTheDocument()
  })
})

describe('SubscriptionDetails hosting ladder (Oct 3)', () => {
  it('a ladder plan shows its step name and every perk up to it (cumulative)', () => {
    render(
      <SubscriptionDetails
        subscriptions={[{ ...plan(7500), entitlements: entitlementsFor({ stepId: 'leads' }), includedEdit: { used: 0, available: 1 } }]}
      />
    )
    const box = screen.getByTestId('plan-step')
    expect(box).toHaveTextContent('Leads')
    // priorityQueue is covered by the [STRICT] Priority line above the list, so it is not repeated.
    for (const perk of cumulativePerks('leads').filter((p) => p !== 'priorityQueue')) expect(box).toHaveTextContent(PERK_LINES[perk])
    expect(box).not.toHaveTextContent(PERK_LINES.gbpManaged)
    expect(screen.getByText(LINE)).toBeInTheDocument()
    expect(screen.getByTestId('included-edit')).toHaveTextContent(INCLUDED_EDIT_LINE(0, 1))
  })

  it('Starter: no Priority line, no included edit line', () => {
    render(<SubscriptionDetails subscriptions={[{ ...plan(3500), entitlements: entitlementsFor({ stepId: 'starter' }) }]} />)
    expect(screen.queryByText(LINE)).toBeNull()
    expect(screen.queryByTestId('included-edit')).toBeNull()
  })

  it('a grandfathered add-on plan is labelled legacy, keeps its Priority by total, and shows no new perks', () => {
    const ent = entitlementsFor({ legacy: { hostingCents: 4000, addonTier: 'pro' } })
    render(<SubscriptionDetails subscriptions={[{ ...plan(5500), entitlements: ent, includedEdit: { used: 1, available: 1 } }]} />)
    expect(screen.getByTestId('legacy-plan')).toHaveTextContent(LEGACY_PLAN_LABEL)
    expect(screen.queryByTestId('plan-step')).toBeNull()
    expect(screen.getByText(LINE)).toBeInTheDocument()
    expect(screen.getByTestId('included-edit')).toHaveTextContent(INCLUDED_EDIT_LINE(1, 1))
    expect(document.body).not.toHaveTextContent(/backup|downtime alert|uptime/i)
  })
})
