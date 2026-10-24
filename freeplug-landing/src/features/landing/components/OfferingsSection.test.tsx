import { render, screen, within } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { setTestLocale } from '../../../../test/intl-mock'
import { OfferingsSection } from './OfferingsSection'

const maint = vi.hoisted(() => ({ on: false }))
vi.mock('@/lib/auth/signups-paused', async (orig) => ({
  ...(await orig<object>()),
  get AUTH_MAINTENANCE() {
    return maint.on
  },
}))

afterEach(() => setTestLocale('en'))

describe('OfferingsSection (What we build)', () => {
  it('renders 6 cards in order, each linking to the existing request flow', () => {
    render(<OfferingsSection />)
    expect(screen.getByRole('heading', { level: 2, name: 'Landing pages, booking sites and one-product stores' })).toBeTruthy()
    const items = within(screen.getByTestId('offerings-grid')).getAllByRole('listitem')
    expect(items).toHaveLength(6)
    const titles = items.map((li) => within(li).getByRole('heading', { level: 3 }).textContent)
    expect(titles).toEqual([
      'Local business websites',
      'Small agencies',
      'Landing pages for creators',
      'Booking sites for freelancers',
      'One-product stores',
      'Small SaaS apps',
    ])
    const hrefs = items.map((li) => within(li).getByRole('link').getAttribute('href'))
    expect(hrefs).toEqual(Array(6).fill('/request-website'))
  })
  it('only the SaaS card has the Simple apps only tag', () => {
    render(<OfferingsSection />)
    expect(screen.getAllByText('Simple apps only')).toHaveLength(1)
    expect(within(screen.getByTestId('offering-saas')).getByText('Simple apps only')).toBeTruthy()
  })
  it('grid is 1 column on mobile, 2 on tablet, 3 on desktop', () => {
    render(<OfferingsSection />)
    const cls = screen.getByTestId('offerings-grid').className
    expect(cls).toContain('grid-cols-1')
    expect(cls).toContain('md:grid-cols-2')
    expect(cls).toContain('lg:grid-cols-3')
  })
  it('Spanish uses Sable text and /es links', () => {
    setTestLocale('es')
    render(<OfferingsSection />)
    expect(screen.getByRole('heading', { level: 2, name: 'Landing pages, sitios de reservas y tiendas de un producto' })).toBeTruthy()
    expect(screen.getByText('Tiendas de un producto')).toBeTruthy()
    const link = within(screen.getByTestId('offering-store')).getByRole('link')
    expect(link.getAttribute('href')).toMatch(/^\/es\/request-website$/)
  })
})

describe('OfferingsSection during auth maintenance', () => {
  afterEach(() => {
    maint.on = false
  })
  it('cards book a call (Cal.com, new tab) instead of the login-gated request flow', () => {
    maint.on = true
    setTestLocale('en')
    const { container } = render(<OfferingsSection />)
    const hrefs = [...container.querySelectorAll('a')].map((a) => a.getAttribute('href'))
    expect(hrefs.length).toBe(6)
    expect(hrefs.every((h) => h?.startsWith('https://cal.com/'))).toBe(true)
  })
})
