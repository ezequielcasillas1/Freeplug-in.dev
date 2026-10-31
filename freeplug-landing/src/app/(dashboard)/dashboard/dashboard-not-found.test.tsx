import { render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import en from '../../../../messages/en.json'
import es from '../../../../messages/es.json'

vi.mock('next-intl/server', () => ({
  getTranslations: async (ns: string) => (key: string) => {
    let v: unknown = en
    for (const k of `${ns}.${key}`.split('.')) v = (v as Record<string, unknown>)[k]
    return v as string
  },
}))

import DashboardNotFound from './not-found'

describe('Dashboard not-found (Oct 30: nested <html> inside <main>)', () => {
  it('renders an in-layout message with a link back to the dashboard, no document elements', async () => {
    const { container } = render(await DashboardNotFound())
    expect(screen.getByRole('heading', { level: 1 }).textContent).toBe('Page not found')
    expect(screen.getByRole('link', { name: 'Back to dashboard' }).getAttribute('href')).toBe('/dashboard')
    expect(container.querySelector('html, body, head, main, nav, footer')).toBeNull()
  })

  it('has English and Spanish strings', () => {
    for (const m of [en, es]) {
      const nf = (m as { dashboard: { notFound: Record<string, string> } }).dashboard.notFound
      expect(Object.keys(nf).sort()).toEqual(['body', 'heading', 'link'])
    }
  })
})
