import { render, screen } from '@testing-library/react'
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

describe('HostingPlansSectionUi: only the One-time maintenance CTA is unpaused', () => {
  it('maintenance card CTA is an active link while the other Get-started CTAs stay paused', () => {
    expect(CTA_PAUSED_NOW).toBe(true)
    const { container } = render(<HostingPlansSectionUi signedIn={false} hostingCheckoutAllowed={true} />)
    const links = Array.from(container.querySelectorAll('a')).filter((a) => a.getAttribute('href') === CALCOM_BOOKING_URL)
    expect(links.length).toBeGreaterThanOrEqual(1)
    const paused = screen.getAllByTestId('cta-paused')
    expect(paused.length).toBeGreaterThanOrEqual(1)
    for (const b of paused) {
      expect(b).toBeDisabled()
      expect(b.textContent).toBe('Coming soon')
    }
    expect(screen.getByTestId('in-development-line')).toBeTruthy()
  })
})
