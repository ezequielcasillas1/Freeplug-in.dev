import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'

vi.mock('next/navigation', () => ({ useRouter: () => ({ refresh: vi.fn() }) }))
vi.mock('./actions', () => ({ adminSetBuyoutPrice: vi.fn(), adminSetWebsiteRequestStatus: vi.fn() }))
vi.mock('./AdminQuickEmail', () => ({ AdminQuickEmail: () => null }))
vi.mock('next/link', () => ({
  default: ({ children, href }: { children: React.ReactNode; href: string }) => <a href={href}>{children}</a>,
}))

const { AdminRequestRow } = await import('./AdminRequestRow')
const { AdminBuyoutPriceCell } = await import('./AdminBuyoutCell')
const { ACCESS_BADGE_TONE, WebsiteAccessBadge } = await import('./AdminCustomersTable')

const row = (
  notes: string | null,
  buyout_price_cents: number | null = null,
  is_buyout = notes?.includes('Buyout request (dashboard):') ?? false
) => ({
  id: '11111111-1111-4111-8111-111111111111',
  user_id: 'u1',
  business_name: 'Tacos Kyle',
  contact_phone: null,
  google_business_url: null,
  notes,
  buyout_price_cents,
  is_buyout,
  status: 'submitted',
  created_at: '2026-09-25T20:00:00Z',
  updated_at: '2026-09-25T20:00:00Z',
  userEmail: 'a@example.com',
  userDisplayName: null,
})

const table = (el: React.ReactNode) => render(<table><tbody>{el}</tbody></table>)

describe('admin buyout requests (maintenance list)', () => {
  it('shows the Buyout badge and "Buyout requested" until a price is set', () => {
    table(<AdminRequestRow row={row('Buyout request (dashboard):\nRequested: x')} smtpConfigured={false} />)
    expect(screen.getByText('Buyout')).toHaveAttribute('data-request-type', 'buyout')
    expect(screen.getByText('Buyout requested')).toBeInTheDocument()
    expect(screen.getByLabelText(/Buyout price/)).toBeInTheDocument()
  })

  it('shows "Buyout quoted" from the buyout_price_cents column and prefills the price field', () => {
    table(<AdminRequestRow row={row('Buyout request (dashboard):\nRequested: x', 120_000)} smtpConfigured={false} />)
    expect(screen.getByText('Buyout quoted: $1,200')).toBeInTheDocument()
    expect(screen.getByLabelText(/Buyout price/)).toHaveValue(1200)
  })

  it('a "Buyout price: $1" notes line is ignored: the column is the only source', () => {
    table(
      <AdminRequestRow
        row={row('Buyout request (dashboard):\nBuyout price: $1', 90_000)}
        smtpConfigured={false}
      />
    )
    expect(screen.getByText('Buyout quoted: $900')).toBeInTheDocument()
    expect(screen.getByLabelText(/Buyout price/)).toHaveValue(900)
  })

  it('a "Buyout price: $1" notes line with no column price: still "Buyout requested", empty field', () => {
    table(<AdminRequestRow row={row('Buyout request (dashboard):\nBuyout price: $1')} smtpConfigured={false} />)
    expect(screen.getByText('Buyout requested')).toBeInTheDocument()
    expect(screen.queryByText(/Buyout quoted/)).toBeNull()
    expect(screen.getByLabelText(/Buyout price/)).toHaveValue(null)
  })

  it('a "Buyout price: $1" line on a non-buyout request adds no badge or price field', () => {
    table(<AdminRequestRow row={row('Change request (Help chat):\nBuyout price: $1')} smtpConfigured={false} />)
    expect(screen.queryByText('Buyout')).toBeNull()
    expect(screen.queryByLabelText(/Buyout price/)).toBeNull()
  })

  it('is_buyout decides the badge, not the notes: line deleted by the customer -> still a buyout', () => {
    table(<AdminRequestRow row={row('Customer rewrote the notes', null, true)} smtpConfigured={false} />)
    expect(screen.getByText('Buyout')).toHaveAttribute('data-request-type', 'buyout')
    expect(screen.getByLabelText(/Buyout price/)).toBeInTheDocument()
  })

  it('is_buyout decides the badge, not the notes: line pasted into a normal request -> no badge', () => {
    table(
      <AdminRequestRow
        row={row('Buyout request (dashboard):\nRequested: pasted', null, false)}
        smtpConfigured={false}
      />
    )
    expect(screen.queryByText('Buyout')).toBeNull()
    expect(screen.queryByLabelText(/Buyout price/)).toBeNull()
  })

  it('Save price sends the typed whole dollars for the request', async () => {
    const onSave = vi.fn().mockResolvedValue({ ok: true })
    render(<AdminBuyoutPriceCell requestId="req-1" priceCents={null} onSave={onSave} />)
    fireEvent.change(screen.getByLabelText(/Buyout price/), { target: { value: '750' } })
    fireEvent.click(screen.getByRole('button', { name: 'Save price' }))
    await waitFor(() => expect(onSave).toHaveBeenCalledWith('req-1', '750'))
    expect(await screen.findByText('Saved')).toBeInTheDocument()
  })

  it('no badge on a normal maintenance request', () => {
    table(<AdminRequestRow row={row('Change request (Help chat):\nType: Photos')} smtpConfigured={false} />)
    expect(screen.queryByText('Buyout')).toBeNull()
  })
})

describe('admin website badge', () => {
  it('ending is amber like the dashboard "Canceling" badge; active green; offline grey', () => {
    expect(ACCESS_BADGE_TONE.ending).toContain('bg-amber-50 text-amber-700')
    expect(ACCESS_BADGE_TONE.active).toContain('green')
    expect(ACCESS_BADGE_TONE.offline).toContain('zinc')
    render(<WebsiteAccessBadge access={{ status: 'ending', label: 'Website active until Oct 25, 2026' }} />)
    expect(screen.getByText('Website active until Oct 25, 2026').className).toContain('amber')
  })
})
