import { render, screen, within } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import { HostingPlansSectionUi } from './HostingPlansSectionUi'
import { CALCOM_BOOKING_URL } from '@/lib/booking'
import { CTA_PAUSED_NOW } from '@/lib/cta-pause'

vi.mock('framer-motion', async () => {
  const React = await import('react')
  const strip = ({ variants, initial, whileInView, viewport, animate, ...rest }: Record<string, unknown>) => rest
  const motion = new Proxy({}, { get: (_t, tag: string) => (p: Record<string, unknown>) => React.createElement(tag, strip(p)) })
  return { motion }
})

describe('HostingPlansSectionUi: One-time maintenance card is info-only', () => {
  it('maintenance card has no button, link, or action wording; other CTAs stay paused', () => {
    expect(CTA_PAUSED_NOW).toBe(true)
    const { container } = render(<HostingPlansSectionUi signedIn={false} hostingCheckoutAllowed={true} />)
    const card = screen.getByTestId('maintenance-plan-card')
    expect(card.querySelectorAll('a, button, [role="button"], [role="link"]').length).toBe(0)
    expect(within(card).queryByTestId('cta-paused')).toBeNull()
    expect(card.textContent).toContain('One-time maintenance')
    expect(card.textContent).toContain('$50')
    for (const w of ['Request maintenance', 'Pedir mantenimiento', 'Coming soon', 'Book', 'Get started']) {
      expect(card.textContent).not.toContain(w)
    }
    expect(Array.from(container.querySelectorAll('a')).some((a) => a.getAttribute('href') === CALCOM_BOOKING_URL)).toBe(false)
    const paused = screen.getAllByTestId('cta-paused')
    expect(paused.length).toBeGreaterThanOrEqual(1)
    for (const b of paused) {
      expect(b).toBeDisabled()
      expect(b.textContent).toBe('Coming soon')
    }
    expect(screen.getByTestId('in-development-line')).toBeTruthy()
  })
})
