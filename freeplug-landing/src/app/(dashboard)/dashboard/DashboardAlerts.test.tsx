import { render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { DashboardAlerts } from './DashboardAlerts'

describe('DashboardAlerts: the optional gray detail line (Sable, carried small amount)', () => {
  it('renders the detail as a gray small line under the message', () => {
    render(<DashboardAlerts alerts={[{ id: 'upcoming-billing', type: 'info', title: 'Upcoming billing', message: 'Your next payment of $71.35 is due in 5 days.', detail: 'Includes $0.35 left from your last change.' }]} />)
    const d = screen.getByTestId('alert-detail')
    expect(d.textContent).toBe('Includes $0.35 left from your last change.')
    expect(d.className).toMatch(/text-xs/)
    expect(d.className).toMatch(/text-gray-500/)
    expect(screen.getByText('Your next payment of $71.35 is due in 5 days.').compareDocumentPosition(d) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy()
  })
  it('no detail: no gray line', () => {
    render(<DashboardAlerts alerts={[{ id: 'upcoming-billing', type: 'info', title: 'Upcoming billing', message: 'Your next payment of $60.75 is due in 5 days.' }]} />)
    expect(screen.queryByTestId('alert-detail')).toBeNull()
  })
})
