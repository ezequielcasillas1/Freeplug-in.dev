import { render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { SubscriptionDetails } from './SubscriptionDetails'
import type { SubscriptionDetail } from './dashboard-actions'
import { cumulativePerks, entitlementsFor } from '@/lib/plans/ladder'
import { CHANGE_PLAN_LINK, INCLUDED_EDIT_LINE, LEGACY_PLAN_LABEL, PERK_LINES } from '@/lib/plans/ladder-copy'

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

describe('SubscriptionDetails: no "Priority included" line (Sable, round 5)', () => {
  it.each([3500, 5000, 5500, 7500])('never shown, at $%i cents/month either', (cents) => {
    render(<SubscriptionDetails subscriptions={[plan(cents)]} />)
    // The old dashboard line was removed with PRIORITY_DASHBOARD_LINE (round 5b); the plan card shows
    // Priority only through the perk list.
    expect(document.body).not.toHaveTextContent(/Priority included/i)
    expect(document.body).not.toHaveTextContent(/front of our queue|ahead of lower plans/i)
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
  it('a ladder plan shows every perk up to it (cumulative), Priority perk included; no separate step-name line', () => {
    render(
      <SubscriptionDetails
        subscriptions={[{ ...plan(7500), entitlements: entitlementsFor({ stepId: 'leads' }), includedEdit: { used: 0, available: 1 } }]}
      />
    )
    const box = screen.getByTestId('plan-step')
    expect(box.querySelector('p')).toBeNull()
    expect(box).not.toHaveTextContent(/^Leads/)
    for (const perk of cumulativePerks('leads')) expect(box).toHaveTextContent(PERK_LINES[perk])
    expect(box).toHaveTextContent(PERK_LINES.priorityQueue)
    expect(box).not.toHaveTextContent(PERK_LINES.gbpManaged)
    expect(screen.queryByText(/Priority included/i)).toBeNull()
    expect(screen.getByTestId('included-edit')).toHaveTextContent(INCLUDED_EDIT_LINE(0, 1))
  })

  it('Starter: no Priority line, no included edit line', () => {
    render(<SubscriptionDetails subscriptions={[{ ...plan(3500), entitlements: entitlementsFor({ stepId: 'starter' }) }]} />)
    expect(screen.queryByText(/Priority included/i)).toBeNull()
    expect(screen.queryByTestId('included-edit')).toBeNull()
  })

  it('a grandfathered add-on plan is labelled legacy and shows no new perks (no Priority line either)', () => {
    const ent = entitlementsFor({ legacy: { hostingCents: 4000, addonTier: 'pro' } })
    render(<SubscriptionDetails subscriptions={[{ ...plan(5500), entitlements: ent, includedEdit: { used: 1, available: 1 } }]} />)
    expect(screen.getByTestId('legacy-plan')).toHaveTextContent(LEGACY_PLAN_LABEL)
    expect(screen.queryByTestId('plan-step')).toBeNull()
    expect(screen.queryByText(/Priority included/i)).toBeNull()
    expect(screen.getByTestId('included-edit')).toHaveTextContent(INCLUDED_EDIT_LINE(1, 1))
    expect(document.body).not.toHaveTextContent(/backup|downtime alert|uptime/i)
  })
})

describe('SubscriptionDetails plan card links (Lina §3c, round 4)', () => {
  const ladder = (pendingChange: SubscriptionDetail['pendingChange'] = null): SubscriptionDetail => ({
    ...plan(6500),
    productName: 'Freeplug Hosting: Fast lane',
    entitlements: entitlementsFor({ stepId: 'fast_lane' }),
    pendingChange,
  })

  it('a pending downgrade: one amber line and a "Keep <current>" text link to Plans (no button here)', () => {
    render(<SubscriptionDetails subscriptions={[ladder({ stepName: 'Starter', date: 'November 3, 2026' })]} />)
    const line = screen.getByTestId('home-pending-change')
    expect(line).toHaveTextContent('Changing to Starter on November 3, 2026. You keep your current plan until then.')
    expect(line.className).toMatch(/text-amber-800/)
    const keep = screen.getByRole('link', { name: 'Keep Fast lane' })
    expect(keep).toHaveAttribute('href', '/dashboard/plans')
    expect(screen.queryByRole('button')).toBeNull()
  })

  it('one "Change plan →" link (CHANGE_PLAN_LINK) to Plans in the footer, next to Cancel options; no pending line without a pending change', () => {
    render(<SubscriptionDetails subscriptions={[ladder()]} />)
    expect(screen.queryByTestId('home-pending-change')).toBeNull()
    expect(screen.queryByTestId('home-change-plan')).toBeNull()
    const links = screen.getAllByRole('link', { name: CHANGE_PLAN_LINK })
    expect(links).toHaveLength(1)
    expect(links[0]).toHaveAttribute('href', '/dashboard/plans')
    expect(screen.queryByText(/Manage plans/)).toBeNull()
    expect(screen.getByRole('link', { name: 'Cancel options' })).toHaveAttribute('href', '/dashboard/cancel')
  })

  it('Cancel options is still there while a downgrade is pending (cancel messages point to it)', () => {
    render(<SubscriptionDetails subscriptions={[ladder({ stepName: 'Starter', date: 'November 3, 2026' })]} />)
    expect(screen.getByRole('link', { name: 'Cancel options' })).toHaveAttribute('href', '/dashboard/cancel')
  })
})

describe('Active Subscriptions list name (Sable 5:11 PM)', () => {
  it('reads "Fast lane + $4 tip", not the Stripe product names', () => {
    render(<SubscriptionDetails subscriptions={[{ ...plan(6900), productName: 'Freeplug Hosting: Fast lane + Optional monthly tip', planName: 'Fast lane', listName: 'Fast lane + $4 tip', entitlements: entitlementsFor({ stepId: 'fast_lane' }) }]} />)
    expect(screen.getByRole('heading', { name: 'Fast lane + $4 tip' })).toBeInTheDocument()
    expect(document.body).not.toHaveTextContent(/Optional monthly tip|Freeplug Hosting:/)
  })
})
