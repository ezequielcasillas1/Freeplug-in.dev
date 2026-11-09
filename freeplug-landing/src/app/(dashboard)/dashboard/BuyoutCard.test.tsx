import { act, fireEvent, render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import { BuyoutCard, DashboardBuyoutCard } from './BuyoutCard'
import { BUYOUT_THANKS } from '@/lib/buyout/buyout'
import type { WebsiteAccess } from '@/lib/website-access'

const END = new Date('2026-10-25T00:00:00Z')
const states: [string, WebsiteAccess][] = [
  ['active', { status: 'active', accessEndsAt: null, hasHostingHistory: true }],
  ['ending', { status: 'ending', accessEndsAt: END, hasHostingHistory: true }],
  ['offline', { status: 'offline', accessEndsAt: null, hasHostingHistory: true }],
]

describe('DashboardBuyoutCard', () => {
  it.each(states)('shows "Want to keep your website?" for %s customers', (_s, access) => {
    render(<DashboardBuyoutCard access={access} alreadyRequested={false} onRequest={vi.fn()} />)
    expect(screen.getByText('Want to keep your website?')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Request my buyout' })).toBeInTheDocument()
  })

  it('is hidden for customers who never had hosting', () => {
    const { container } = render(
      <DashboardBuyoutCard
        access={{ status: 'offline', accessEndsAt: null, hasHostingHistory: false }}
        alreadyRequested={false}
        onRequest={vi.fn()}
      />
    )
    expect(container).toBeEmptyDOMElement()
  })

  it('shows the thank-you line instead of the button when a request is already open', () => {
    render(<DashboardBuyoutCard access={states[0][1]} alreadyRequested onRequest={vi.fn()} />)
    expect(screen.getByText(BUYOUT_THANKS)).toBeInTheDocument()
    expect(screen.queryByRole('button')).toBeNull()
  })
})

describe('BuyoutRequestButton', () => {
  it('uses the outline (secondary) style, not the red primary', () => {
    render(<BuyoutCard variant="cancel" alreadyRequested={false} onRequest={vi.fn()} />)
    const btn = screen.getByRole('button', { name: 'Request my buyout' })
    expect(btn.className).toContain('border-2')
    expect(btn.className).not.toContain('bg-[#ba3d3d] text-white')
    expect(screen.getByText('Keep your website')).toBeInTheDocument()
  })

  it('a double click sends one request, then the thank-you line replaces the button', async () => {
    let resolve!: (v: { ok: true; alreadyRequested: boolean }) => void
    const onRequest = vi.fn(() => new Promise<{ ok: true; alreadyRequested: boolean }>((r) => (resolve = r)))
    render(<BuyoutCard variant="dashboard" alreadyRequested={false} onRequest={onRequest} />)
    const btn = screen.getByRole('button', { name: 'Request my buyout' })
    await act(async () => {
      fireEvent.click(btn)
    })
    expect(btn).toBeDisabled()
    await act(async () => {
      fireEvent.click(btn)
    })
    expect(onRequest).toHaveBeenCalledTimes(1)
    await act(async () => resolve({ ok: true, alreadyRequested: false }))
    expect(screen.getByTestId('buyout-thanks')).toHaveTextContent(BUYOUT_THANKS)
    expect(screen.queryByRole('button')).toBeNull()
    // Same card: heading still there, so the layout doesn't jump.
    expect(screen.getByTestId('buyout-card-dashboard')).toContainElement(screen.getByTestId('buyout-thanks'))
  })

  it('shows the error and keeps the button when the request fails', async () => {
    const onRequest = vi.fn(async () => ({ ok: false as const, error: 'Try again later.' }))
    render(<BuyoutCard variant="dashboard" alreadyRequested={false} onRequest={onRequest} />)
    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: 'Request my buyout' }))
    })
    expect(screen.getByRole('alert')).toHaveTextContent('Try again later.')
    expect(screen.getByRole('button', { name: 'Request my buyout' })).toBeEnabled()
  })
})

describe('Buyout tiers on the card (Oct 19)', () => {
  it('lists all five tiers up front with their prices', () => {
    render(<BuyoutCard variant="cancel" alreadyRequested={false} onRequest={vi.fn()} />)
    const radios = screen.getAllByRole('radio')
    expect(radios).toHaveLength(5)
    for (const p of ['$500', '$700', '$950', '$1,200', '$2,000']) expect(screen.getByText(p)).toBeInTheDocument()
    expect(screen.getByText(/The buyout covers your website files only/)).toBeInTheDocument()
  })
  it('passes the picked tier to the request, and shows what is left after paid amounts', async () => {
    const onRequest = vi.fn().mockResolvedValue({ ok: true, alreadyRequested: false })
    render(<BuyoutCard variant="dashboard" alreadyRequested={false} onRequest={onRequest} ownership={{ paidCents: 30000, clearingCents: 0 }} />)
    fireEvent.click(screen.getByRole('radio', { name: /Up to 11 pages/ }))
    expect(screen.getByTestId('buyout-due')).toHaveTextContent("After what you've already paid, you'd have $650 left to pay.")
    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: 'Request my buyout' }))
    })
    expect(onRequest).toHaveBeenCalledWith('up_to_11')
  })
})
