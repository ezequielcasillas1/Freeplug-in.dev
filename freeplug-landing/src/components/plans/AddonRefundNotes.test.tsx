import { render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { AddonRefundNotes, recentAddonRefundNotes } from './AddonRefundNotes'
import type { InvoiceRow } from '@/lib/stripe/billing-routing'

/** Aria, Oct 4 9:27: the Plans page tells the customer why an add-on charge was refunded (30 days). */
const NOW = new Date('2026-10-04T14:00:00Z')
const row = (id: string, daysAgo: number, addonRefund: InvoiceRow['addonRefund']): InvoiceRow => ({
  id,
  number: null,
  created: new Date(NOW.getTime() - daysAgo * 86_400_000).toISOString(),
  totalCents: 575,
  tipCents: 0,
  currency: 'usd',
  status: 'paid',
  hostedUrl: null,
  pdfUrl: null,
  addonRefund,
})

describe('AddonRefundNotes (Plans page)', () => {
  it('one note per refunded add-on charge in the last 30 days: the reason, then where the money went', () => {
    const rows = [
      row('in_a', 1, { kind: 'first_period', addon: 'big_change', addons: ['big_change'], reason: 'period_ended', cardCents: 35, creditCents: 540 }),
      row('in_b', 2, null),
      row('in_c', 29, { kind: 'first_period', addon: 'small_edit', addons: ['small_edit'], reason: 'switch_pending', cardCents: 0, creditCents: 500 }),
      row('in_old', 31, { kind: 'first_period', addon: 'small_edit', addons: ['small_edit'], reason: 'not_added', cardCents: 500, creditCents: 0 }),
    ]
    expect(recentAddonRefundNotes(rows, NOW)).toEqual([
      {
        id: 'in_a',
        text: "We couldn't turn on Big change because the billing period you paid for ended before we could add it. We refunded $0.35 to your card and added $5.40 back to your account credit. The card refund can take 5–10 business days to show up.",
      },
      {
        id: 'in_c',
        text: "We couldn't turn on +1 small edit because a plan switch was already scheduled. Add-ons can't change until the switch happens. We added $5 back to your account credit.",
      },
    ])
    render(<AddonRefundNotes invoices={rows} now={NOW} />)
    expect(screen.getAllByTestId('addon-refund-note')).toHaveLength(2)
    expect(screen.getAllByRole('status')[0]).toHaveTextContent('We refunded $0.35 to your card')
  })
  it('nothing refunded: renders nothing', () => {
    const { container } = render(<AddonRefundNotes invoices={[row('in_b', 1, null)]} now={NOW} />)
    expect(container.innerHTML).toBe('')
    expect(recentAddonRefundNotes(null, NOW)).toEqual([])
  })
})
