import { render, screen, within } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { BillingTools } from './BillingTools'
import type { InvoiceRow } from '@/lib/stripe/billing-routing'

const row = (over: Partial<InvoiceRow>): InvoiceRow => ({
  id: 'in_1', number: 'N-1', created: '2026-10-03T20:00:00.000Z', totalCents: 6500, tipCents: 0, currency: 'usd', status: 'paid', hostedUrl: null, pdfUrl: null, ...over,
})

describe('BillingTools invoice list: the tip on its own line (round 5b)', () => {
  it('an invoice with a tip shows "Plan $65.00 · Optional tip $5.00" under its total; one without shows no tip line', () => {
    render(<BillingTools updateCardAction={async () => undefined} invoices={[row({ id: 'in_tip', totalCents: 7000, tipCents: 500 }), row({ id: 'in_plain' })]} />)
    const items = screen.getAllByRole('listitem')
    expect(items[0]).toHaveTextContent('$70.00')
    expect(within(items[0]).getByTestId('invoice-tip')).toHaveTextContent('Plan $65.00 · Optional tip $5.00')
    expect(within(items[1]).queryByTestId('invoice-tip')).toBeNull()
  })
})
