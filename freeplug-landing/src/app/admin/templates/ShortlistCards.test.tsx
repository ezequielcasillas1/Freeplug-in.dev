import { readFileSync } from 'node:fs'
import path from 'node:path'
import { render, screen, within } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { ShortlistCards } from './ShortlistCards'

const pick = {
  envato_item_id: 1,
  niche: 'cleaning',
  name: 'Sparkle Clean',
  url: 'https://themeforest.net/item/x/1',
  platform: 'WP',
  verify_status: 'confirmed',
  verify_reason: 'checked demo',
  regular_price_cents: 5900,
  extended_price_cents: 295000,
}

describe('Shortlist at 375 px (Lina): stacked cards like Needs Lina; table stays at sm+', () => {
  it('renders name, one gray platform + Regular/Extended line, then Status', () => {
    render(<ShortlistCards picks={[pick]} />)
    const list = screen.getByTestId('shortlist-cards')
    expect(list.className).toContain('sm:hidden')
    const card = within(list).getByRole('listitem')
    expect(within(card).getByRole('link', { name: 'Sparkle Clean' }).getAttribute('href')).toBe(pick.url)
    const meta = within(card).getByTestId('card-meta')
    expect(meta.className).toContain('text-zinc-500')
    expect(meta.textContent).toMatch(/^WP · Regular \$59 · Extended \$2,950$/)
    expect(within(card).getByTestId('card-status').textContent).toBe('Status: confirmedchecked demo')
  })

  it('page shows the cards below sm and keeps the unchanged table at sm+', () => {
    const page = readFileSync(path.join(__dirname, 'page.tsx'), 'utf8')
    expect(page).toContain('<ShortlistCards picks={picks} />')
    expect(page).toMatch(/<div className="hidden sm:block">\s*<ScrollX testId="shortlist-scroll">/)
    expect(page).toContain('<th>Platform</th><th>Regular</th><th>Extended</th><th>Status</th><th>Build note</th><th>Demo</th>')
  })

  it('prices use thousands separators in the cards and the table formatter', async () => {
    const { formatCents } = await import('./view')
    expect(formatCents(180000)).toBe('$1,800')
    expect(formatCents(5950)).toBe('$59.50')
    expect(formatCents(null)).toBe('—')
    render(<ShortlistCards picks={[{ ...pick, envato_item_id: 2, extended_price_cents: 180000 }]} />)
    expect(screen.getAllByTestId('card-meta').at(-1)!.textContent).toContain('Extended $1,800')
  })
})
