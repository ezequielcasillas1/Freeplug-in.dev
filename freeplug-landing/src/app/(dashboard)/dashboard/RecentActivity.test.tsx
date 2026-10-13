import { render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { RecentActivity } from './RecentActivity'
import type { ActivityItem } from './dashboard-actions'
import { paymentActivityLabel } from '@/lib/dashboard/billing-activity'

const payment: ActivityItem = {
  id: 'payment-led_1',
  type: 'payment',
  title: 'Payment received',
  description: paymentActivityLabel(3500, '2026-10-03T15:00:00.000Z'),
  date: new Date('2026-10-03T15:00:00.000Z'),
  amount: 3500,
}

describe('RecentActivity (billing_ledger description fix)', () => {
  it('shows a payment row with its label and amount', () => {
    render(<RecentActivity activities={[payment]} />)
    expect(screen.getByText('Payment received')).toBeInTheDocument()
    expect(screen.getByText('Payment of $35.00 on Oct 3, 2026')).toBeInTheDocument()
    expect(screen.getByText('+$35.00')).toBeInTheDocument()
    expect(screen.queryByTestId('recent-activity-error')).toBeNull()
  })

  it("load failure: shows the couldn't-load state, not the empty 'No recent activity' state", () => {
    render(<RecentActivity activities={[]} loadFailed />)
    const el = screen.getByTestId('recent-activity-error')
    expect(el).toHaveAttribute('role', 'alert')
    expect(el).toHaveTextContent("Couldn't load activity")
    expect(el).toHaveTextContent('Refresh the page to try again.')
    expect(screen.queryByText('No recent activity to display.')).toBeNull()
  })

  it('no activity and no failure: the existing empty state is unchanged', () => {
    render(<RecentActivity activities={[]} />)
    expect(screen.getByText('No recent activity to display.')).toBeInTheDocument()
  })

  it('a zero amount renders no stray "0"', () => {
    render(<RecentActivity activities={[{ ...payment, amount: 0, description: 'Payment of $0.00' }]} />)
    expect(screen.queryByText('0')).toBeNull()
  })
})

describe('paymentActivityLabel', () => {
  it('uses amount and date, falling back when either is missing', () => {
    expect(paymentActivityLabel(3500, '2026-10-03T15:00:00.000Z')).toBe('Payment of $35.00 on Oct 3, 2026')
    expect(paymentActivityLabel(3500, null)).toBe('Payment of $35.00')
    expect(paymentActivityLabel(null, '2026-10-03T15:00:00.000Z')).toBe('Payment on Oct 3, 2026')
    expect(paymentActivityLabel(undefined, 'not a date')).toBe('Payment')
  })
})
