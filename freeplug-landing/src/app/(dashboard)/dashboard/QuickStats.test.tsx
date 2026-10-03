import { render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { QuickStats } from './QuickStats'
import type { DashboardStats } from './dashboard-actions'

const stats: DashboardStats = { totalPaidCents: 0, activeSubscriptionCount: 0, daysSinceFirstPayment: null, websiteStatus: 'pending', invoiceCount: 0 }

describe('QuickStats Website card (round 9)', () => {
  it('non-outreach: unchanged, from the account stats', () => {
    render(<QuickStats stats={stats} />)
    expect(screen.getByTestId('website-status')).toHaveTextContent('Pending')
  })

  it('outreach live: "Live" in green even when the stats say pending', () => {
    render(<QuickStats stats={stats} website={{ label: 'Live', tone: 'live' }} />)
    const el = screen.getByTestId('website-status')
    expect(el).toHaveTextContent('Live')
    expect(el.className).toContain('text-green-600')
  })

  it('outreach before live: the tracker step, in amber', () => {
    render(<QuickStats stats={{ ...stats, websiteStatus: 'live' }} website={{ label: 'Hosting set up', tone: 'progress' }} />)
    const el = screen.getByTestId('website-status')
    expect(el).toHaveTextContent('Hosting set up')
    expect(el.className).toContain('text-amber-600')
  })
})

describe('QuickStats Active Plans tile (round 10, Lina)', () => {
  it('outreach live, plan cannot load: a dash styled like the "Customer Since" dash', () => {
    render(<QuickStats stats={stats} website={{ label: 'Live', tone: 'live' }} activePlansDash />)
    const plans = screen.getByTestId('active-plans')
    const since = screen.getByTestId('customer-since')
    expect(plans.textContent).toBe('—')
    expect(since.textContent).toBe('—')
    expect(plans.className).toBe(since.className)
    expect(plans.textContent).not.toContain('0')
  })

  it('outreach live with a plan: the real count', () => {
    render(<QuickStats stats={{ ...stats, activeSubscriptionCount: 1 }} website={{ label: 'Live', tone: 'live' }} activePlansDash={false} />)
    expect(screen.getByTestId('active-plans').textContent).toBe('1')
  })

  it('non-outreach: the count, 0 included (unchanged)', () => {
    render(<QuickStats stats={stats} />)
    expect(screen.getByTestId('active-plans').textContent).toBe('0')
  })
})
