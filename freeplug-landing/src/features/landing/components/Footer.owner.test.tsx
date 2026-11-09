import { render, screen, within } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { setTestLocale } from '../../../../test/intl-mock'

vi.mock('next/navigation', () => ({
  useRouter: () => ({ push: vi.fn(), replace: vi.fn(), refresh: vi.fn() }),
  usePathname: () => '/',
  useSearchParams: () => new URLSearchParams(),
}))

import { Footer } from './Footer'

beforeEach(() => {
  vi.stubEnv('FREEPLUG_I18N_ES_ALLOW_PENDING', '1')
  vi.stubGlobal('IntersectionObserver', class { observe() {} unobserve() {} disconnect() {} takeRecords() { return [] } })
})
afterEach(() => {
  setTestLocale('en')
  vi.unstubAllEnvs()
  vi.unstubAllGlobals()
})

function check(line: string) {
  const p = screen.getByTestId('footer-owner')
  expect(p.textContent).toContain(line)
  const bsky = within(p).getByRole('link', { name: 'Bluesky @casiezeq' })
  const x = within(p).getByRole('link', { name: 'X @casiezeq' })
  expect(bsky.getAttribute('href')).toBe('https://bsky.app/profile/casiezeq.bsky.social')
  expect(x.getAttribute('href')).toBe('https://x.com/casiezeq')
  for (const a of [bsky, x]) {
    expect(a.getAttribute('target')).toBe('_blank')
    expect(a.getAttribute('rel')).toBe('noopener noreferrer me')
  }
}

describe('footer owner line', () => {
  it('English', () => { render(<Footer />); check('Get to know the owner:') })
  it('Spanish', () => { setTestLocale('es'); render(<Footer />); check('Conoce al dueño:') })
})
