import { render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { ClaimStartForm } from './ClaimStartForm'

const LINE = "Tap the button to start claiming it. You won't pay anything unless you pick a hosting plan and your site goes live."
const STALE = 'This page was open for a while, so we refreshed it. Tap Claim my website again to continue.'

describe('claim start form (Vera r2 bug 9)', () => {
  const submit = vi.spyOn(HTMLFormElement.prototype, 'requestSubmit').mockImplementation(() => {})
  afterEach(() => submit.mockClear())

  it('is a POST to /claim/start with a "Claim my website" button', () => {
    render(<ClaimStartForm auto={false} token="tok" businessName="Gracia Lawn Care" />)
    const form = screen.getByTestId('claim-start-form')
    expect(form).toHaveAttribute('method', 'post')
    expect(form).toHaveAttribute('action', '/claim/start')
    expect(screen.getByRole('button', { name: 'Claim my website' })).toHaveAttribute('type', 'submit')
    expect(form.querySelector('input[type="hidden"][name="t"]')).toHaveValue('tok')
    expect(submit).not.toHaveBeenCalled()
  })

  it('submits once by itself when auto is on', () => {
    const { rerender } = render(<ClaimStartForm auto token="tok" businessName="Gracia Lawn Care" />)
    rerender(<ClaimStartForm auto token="tok" businessName="Gracia Lawn Care" />)
    expect(submit).toHaveBeenCalledTimes(1)
  })
})

describe('claim-start card (Lina gap 1, Sable 1:46 AM)', () => {
  const submit = vi.spyOn(HTMLFormElement.prototype, 'requestSubmit').mockImplementation(() => {})
  afterEach(() => submit.mockClear())

  it('heading with the business name, one grey line, then one red "Claim my website" button', () => {
    render(<ClaimStartForm auto={false} token="tok" businessName="Gracia Lawn Care" />)
    const card = screen.getByTestId('claim-start-card')
    expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent('We built this website for Gracia Lawn Care')
    const line = screen.getByTestId('claim-card-line')
    expect(line).toHaveTextContent(LINE)
    expect(line.className).toContain('text-gray-600')
    expect(card.querySelectorAll('p')).toHaveLength(1)
    const buttons = card.querySelectorAll('button')
    expect(buttons).toHaveLength(1)
    expect(buttons[0]).toHaveAttribute('data-emphasis', 'red')
    // Order: heading, grey line, button.
    const order = Array.from(card.querySelectorAll('h1, p, button')).map((n) => n.tagName)
    expect(order).toEqual(['H1', 'P', 'BUTTON'])
  })

  it('stale token (Sable 1:45 AM): the refreshed line replaces the grey line, same card, never auto-submits', () => {
    render(<ClaimStartForm auto stale token="fresh" businessName="Gracia Lawn Care" />)
    const card = screen.getByTestId('claim-start-card')
    expect(screen.getByTestId('claim-card-line')).toHaveTextContent(STALE)
    expect(screen.getByTestId('claim-card-line')).toHaveAttribute('data-stale', 'true')
    expect(card.textContent).not.toContain(LINE)
    expect(card.querySelectorAll('p')).toHaveLength(1)
    expect(card.querySelectorAll('button')).toHaveLength(1)
    expect(card.querySelector('input[name="t"]')).toHaveValue('fresh')
    expect(submit).not.toHaveBeenCalled()
  })
})
