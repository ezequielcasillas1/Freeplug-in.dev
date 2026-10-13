import { readFileSync } from 'node:fs'
import path from 'node:path'
import { render, screen } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'

/** Aria, Oct 4 9:57: the add-on refund note on the main dashboard too (same 30 days, same wording as Plans). */
const h = vi.hoisted(() => ({ invoices: [] as unknown[], fail: false }))
vi.mock('@/lib/stripe/server', () => ({
  getStripe: () => ({
    invoices: {
      list: async () => {
        if (h.fail) throw new Error('down')
        return { data: h.invoices }
      },
    },
  }),
}))

import { DashboardAddonRefundNotes } from './DashboardAddonRefundNotes'
import { recentAddonRefundNotes } from '@/components/plans/AddonRefundNotes'
import { listInvoicesForCustomer } from '@/lib/stripe/billing-routing'
import { getStripe } from '@/lib/stripe/server'

const NOW = new Date('2026-10-04T15:00:00Z')
const sec = (daysAgo: number) => Math.floor(NOW.getTime() / 1000) - daysAgo * 86_400
const firstPeriod = (id: string, daysAgo: number, card: number, credit: number) => ({
  id, status: 'paid', number: null, created: sec(daysAgo), total: 575, amount_paid: card, currency: 'usd', hosted_invoice_url: null, invoice_pdf: null,
  metadata: { freeplug_kind: 'addon_first_period', addon: 'big_change', addon_refunded: 'true', addon_refund_reason: 'switch_pending', addon_refund_card_cents: String(card), addon_refund_credit_cents: String(credit) },
})
const turnedOff = (id: string, daysAgo: number) => ({
  id, status: 'paid', number: null, created: sec(daysAgo), total: 6075, amount_paid: 6075, currency: 'usd', hosted_invoice_url: null, invoice_pdf: null,
  metadata: { addon_refunded: 'true', addon_refund_reason: 'turned_off', addon_turned_off_refunded: 'big_change', addon_refund_card_cents: '575', addon_refund_credit_cents: '0' },
})

describe('DashboardAddonRefundNotes (main dashboard)', () => {
  beforeEach(() => {
    h.fail = false
    vi.spyOn(console, 'error').mockImplementation(() => undefined)
  })

  it('the same notes as the Plans page, newest first, last 30 days only; the card delay sentence only with a card refund', async () => {
    h.invoices = [turnedOff('in_l1', 1), firstPeriod('in_a', 2, 35, 540), firstPeriod('in_c', 3, 0, 575), firstPeriod('in_old', 31, 575, 0)]
    render(await DashboardAddonRefundNotes({ customerId: 'cus_1', now: NOW }))
    const notes = screen.getAllByTestId('addon-refund-note-text').map((n) => n.textContent)
    // Lina 10:33: a gray date line on top of each card (no refund mark on these invoices: the invoice date, CT)
    expect(screen.getAllByTestId('addon-refund-note-date').map((n) => n.textContent)).toEqual(['Oct 3', 'Oct 2', 'Oct 1'])
    for (const card of screen.getAllByTestId('addon-refund-note')) expect(card.firstElementChild).toHaveAttribute('data-testid', 'addon-refund-note-date')
    expect(notes).toEqual([
      'You turned off Big change, but it was still charged this period. We refunded $5.75 to your card. The card refund can take 5–10 business days to show up.',
      "We couldn't turn on Big change because a plan switch was already scheduled. Add-ons can't change until the switch happens. We refunded $0.35 to your card and added $5.40 back to your account credit. The card refund can take 5–10 business days to show up.",
      "We couldn't turn on Big change because a plan switch was already scheduled. Add-ons can't change until the switch happens. We added $5.75 back to your account credit.",
    ])
    // identical to what the Plans page shows for the same invoices
    const rows = await listInvoicesForCustomer(getStripe(), 'cus_1')
    expect(recentAddonRefundNotes(rows, NOW).map((n) => n.text)).toEqual(notes)
  })

  it('no refunds, or Stripe down: nothing', async () => {
    h.invoices = [{ id: 'in_1', status: 'paid', number: 'A-1', created: sec(1), total: 6500, amount_paid: 6500, currency: 'usd', hosted_invoice_url: null, invoice_pdf: null, metadata: {} }]
    const { container, unmount } = render(await DashboardAddonRefundNotes({ customerId: 'cus_1', now: NOW }))
    expect(container.innerHTML).toBe('')
    unmount()
    h.fail = true
    const r = render(await DashboardAddonRefundNotes({ customerId: 'cus_1', now: NOW }))
    expect(r.container.innerHTML).toBe('')
  })

  it('the dashboard page renders it for a customer with a Stripe id', () => {
    const src = readFileSync(path.join(__dirname, 'page.tsx'), 'utf8')
    expect(src).toContain('<DashboardAddonRefundNotes customerId={p.stripe_customer_id} />')
  })
})

describe('L-3 on the main dashboard (same component, from the invoice marks)', () => {
  it('a refund that canceled an unbilled small charge shows the third line', async () => {
    h.fail = false
    const inv = firstPeriod('in_carry', 1, 0, 575)
    h.invoices = [{ ...inv, metadata: { ...inv.metadata, addon_refund_carried_cents: '35' } }]
    render(await DashboardAddonRefundNotes({ customerId: 'cus_1', now: NOW }))
    expect(screen.getByTestId('addon-refund-notes')).toHaveTextContent("We couldn't turn on Big change because a plan switch was already scheduled. Add-ons can't change until the switch happens. We added $5.40 back to your account credit and canceled the $0.35 small charge, so you won't pay it.")
  })
})

