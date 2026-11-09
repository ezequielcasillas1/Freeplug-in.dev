import { describe, expect, it, vi } from 'vitest'
import { render, screen } from '@testing-library/react'

let locale = 'en'
vi.mock('next-intl', () => ({ useLocale: () => locale }))

import { PausedCta, InDevelopmentLine } from './PausedCta'
import { CTA_PAUSED, CTA_PAUSED_NOW } from '@/lib/cta-pause'

describe('CTA pause', () => {
  it('is on by default', () => {
    expect(CTA_PAUSED).toBe(true)
    expect(CTA_PAUSED_NOW).toBe(true)
  })
  it('renders a disabled, non-link button with Coming soon', () => {
    locale = 'en'
    render(<PausedCta className="x" />)
    const b = screen.getByTestId('cta-paused')
    expect(b.tagName).toBe('BUTTON')
    expect(b).toBeDisabled()
    expect(b.getAttribute('aria-disabled')).toBe('true')
    expect(b.getAttribute('href')).toBeNull()
    expect(b.textContent).toBe('Coming soon')
  })
  it('Spanish copy', () => {
    locale = 'es'
    render(<><PausedCta /><InDevelopmentLine /></>)
    expect(screen.getByTestId('cta-paused').textContent).toBe('Muy pronto')
    expect(screen.getByTestId('in-development-line').textContent).toBe('Freeplug está en desarrollo. Muy pronto.')
  })
})
