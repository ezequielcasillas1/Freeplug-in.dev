import { render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { AccountCard } from './AccountCard'

const manage = <button type="submit">Manage billing</button>
const renderCard = (line: Parameters<typeof AccountCard>[0]['line']) =>
  render(<AccountCard email="claimant@local.test" line={line} manageBilling={manage} />)

describe('Account card (Sable 3:42 AM, Lina; round 10)', () => {
  it('outreach before a card: "After you add your card, ..." under the email', () => {
    renderCard('add_card')
    expect(screen.getByTestId('account-billing-line').textContent).toBe(
      'After you add your card, you can manage your billing and payment method here.'
    )
    expect(screen.queryByText('Manage billing')).toBeNull()
    expect(screen.queryByText(/After your first payment/)).toBeNull()
  })

  it('with a Stripe customer: Manage billing replaces the line', () => {
    renderCard('manage_billing')
    expect(screen.getByText('Manage billing')).toBeInTheDocument()
    expect(screen.queryByTestId('account-billing-line')).toBeNull()
  })

  it('outreach live, no Stripe customer: just the email, no line, no leftover gap', () => {
    renderCard('none')
    const card = screen.getByTestId('account-card')
    const email = screen.getByTestId('account-email')
    expect(email.textContent).toBe('claimant@local.test')
    expect(email.className).not.toMatch(/\bmb-/)
    expect(email.nextElementSibling).toBeNull()
    expect(card.children).toHaveLength(2) // heading + email
    expect(card.textContent).toBe('Accountclaimant@local.test')
  })

  it('non-outreach without a Stripe customer: the first-payment line, unchanged', () => {
    renderCard('first_payment')
    expect(screen.getByTestId('account-billing-line').textContent).toBe(
      'After your first payment, you can manage your billing and payment method here.'
    )
    expect(screen.getByTestId('account-billing-line').className).toBe('text-xs text-gray-500')
    expect(screen.getByTestId('account-email').className).toBe('text-gray-900 mb-4')
  })
})
