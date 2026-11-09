import { fireEvent, render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { ChecklistFields } from './ChecklistFields'

describe('ChecklistFields', () => {
  it('shows the buyout tier live as the page count changes, with the own-domain discount', () => {
    render(<ChecklistFields initial={{}} />)
    const live = screen.getByTestId('buyout-tier-live')
    expect(live.textContent).toMatch(/Enter a page count/)
    fireEvent.change(screen.getByRole('spinbutton'), { target: { value: '9' } })
    expect(live.textContent).toMatch(/8 to 11 pages: buyout \$950\./)
    fireEvent.click(screen.getByLabelText(/I already have a domain/))
    expect(live.textContent).toMatch(/\$760 with your own domain/)
    expect(screen.getByPlaceholderText('mybusiness.com')).toBeTruthy()
  })
  it('renders every checklist section', () => {
    render(<ChecklistFields initial={{ site_type: 'other', booking: 'link' }} />)
    for (const h of ['Your website', 'Content and photos', 'Domain', 'Forms, booking and payments', 'Plan and timeline']) {
      expect(screen.getByRole('heading', { name: h })).toBeTruthy()
    }
    expect(screen.getByText('Type (other)')).toBeTruthy()
    expect(screen.getByText('Booking tool')).toBeTruthy()
  })
})
