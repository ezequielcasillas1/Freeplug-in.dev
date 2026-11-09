import { render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { LaunchMarquee, LAUNCH_MARQUEE_COPY } from './LaunchMarquee'

describe('LaunchMarquee', () => {
  it('renders EN copy once for assistive tech with aria-live off', () => {
    render(<LaunchMarquee />)
    const region = screen.getByRole('region', { name: 'Launch announcement' })
    expect(region).toHaveAttribute('aria-live', 'off')
    expect(screen.getByText(LAUNCH_MARQUEE_COPY.en, { selector: 'p' })).toHaveClass('sr-only')
    expect(region.querySelector('.launch-marquee__track')).toHaveAttribute('aria-hidden', 'true')
  })

  it('has the ES string ready', () => {
    render(<LaunchMarquee locale="es" />)
    expect(screen.getByText(LAUNCH_MARQUEE_COPY.es, { selector: 'p' })).toBeInTheDocument()
  })
})
