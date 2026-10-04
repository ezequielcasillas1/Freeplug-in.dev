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
        at: '2026-10-03T14:00:00.000Z',
        dateLabel: 'Oct 3',
        text: "We couldn't turn on Big change because the billing period you paid for ended before we could add it. We refunded $0.35 to your card and added $5.40 back to your account credit. The card refund can take 5–10 business days to show up.",
      },
      {
        id: 'in_c',
        at: '2026-09-05T14:00:00.000Z',
        dateLabel: 'Sep 5',
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

describe('Lina 10:33: a small gray date line at the top of each refund note card', () => {
  const l1 = (refundedAt?: string): InvoiceRow['addonRefund'] => ({ kind: 'turned_off', addon: 'big_change', addons: ['big_change'], reason: 'turned_off', cardCents: 575, creditCents: 0, ...(refundedAt ? { refundedAt } : {}) })
  it('the L-1 card: date line ("Oct 4") first, then Sable\'s reason, the split line and the delay line', () => {
    render(<AddonRefundNotes invoices={[row('in_l1', 0.1, l1('2026-10-04T13:00:00.000Z'))]} now={NOW} />)
    const card = screen.getByTestId('addon-refund-note')
    const date = screen.getByTestId('addon-refund-note-date')
    expect(card.firstElementChild).toBe(date)
    expect(date.textContent).toBe('Oct 4')
    expect(date.className).toContain('text-xs')
    expect(date.className).toContain('text-gray-500')
    expect(date.querySelector('time')).toHaveAttribute('dateTime', '2026-10-04T13:00:00.000Z')
    expect(screen.getByTestId('addon-refund-note-text').textContent).toBe(
      'You turned off Big change, but it was still charged this period. We refunded $5.75 to your card. The card refund can take 5–10 business days to show up.'
    )
  })
  it('the refund time wins over the invoice date; America/Chicago decides the day (11 PM CT is still that day, not tomorrow UTC)', () => {
    // invoice from Sep 30; refunded Oct 3 at 11:30 PM CT (= Oct 4 04:30 UTC)
    const r = row('in_late', 4, l1('2026-10-04T04:30:00.000Z'))
    expect(recentAddonRefundNotes([r], NOW)[0]).toMatchObject({ dateLabel: 'Oct 3', at: '2026-10-04T04:30:00.000Z' })
  })
  it('no refund time recorded (older invoices): the invoice date', () => {
    expect(recentAddonRefundNotes([row('in_old_mark', 2, l1())], NOW)[0]).toMatchObject({ dateLabel: 'Oct 2', at: '2026-10-02T14:00:00.000Z' })
  })
  it('the year only when it is not the current year (in Central time)', () => {
    const jan1 = new Date('2027-01-01T12:00:00Z')
    // Dec 31, 2026 at 8 PM CT = Jan 1 02:00 UTC: a different year in CT
    expect(recentAddonRefundNotes([{ ...row('in_ny', 0, l1('2027-01-01T02:00:00.000Z')), created: '2026-12-31T20:00:00.000Z' }], jan1)[0].dateLabel).toBe('Dec 31, 2026')
    expect(recentAddonRefundNotes([{ ...row('in_ny2', 0, l1('2027-01-01T10:00:00.000Z')), created: '2027-01-01T10:00:00.000Z' }], jan1)[0].dateLabel).toBe('Jan 1')
  })
})

describe("L-3 (Sable, locked): the refund's credit canceled a small charge still unbilled", () => {
  const base = { kind: 'first_period' as const, addon: 'big_change' as const, addons: ['big_change' as const], reason: 'switch_pending' as const }
  const text = (x: InvoiceRow['addonRefund']) => recentAddonRefundNotes([row('in_1', 1, x)], NOW)[0].text
  it('unbilled small charge: the third line, with no delay line', () => {
    const t = text({ ...base, cardCents: 0, creditCents: 575, carriedCents: 35 })
    expect(t).toBe("We couldn't turn on Big change because a plan switch was already scheduled. Add-ons can't change until the switch happens. We added $5.40 back to your account credit and canceled the $0.35 small charge, so you won't pay it.")
    expect(t).not.toContain('business days')
  })
  it('already paid on a bill (no carried mark): the existing credit line', () => {
    expect(text({ ...base, cardCents: 0, creditCents: 575 })).toMatch(/ We added \$5\.75 back to your account credit\.$/)
  })
  it('card part: the existing card + credit line and the delay line (the third line never applies with a card refund)', () => {
    expect(text({ ...base, cardCents: 75, creditCents: 500, carriedCents: 35 })).toMatch(/We refunded \$0\.75 to your card and added \$5 back to your account credit\. The card refund can take 5–10 business days to show up\.$/)
  })
  it('renders on the page', () => {
    render(<AddonRefundNotes invoices={[row('in_1', 1, { ...base, cardCents: 0, creditCents: 575, carriedCents: 35 })]} now={NOW} />)
    expect(screen.getByTestId('addon-refund-notes')).toHaveTextContent("canceled the $0.35 small charge, so you won't pay it.")
  })
})

