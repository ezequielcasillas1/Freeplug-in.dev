import { render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'

vi.mock('./billing-actions', () => ({ resumePlan: vi.fn() }))
const { WebsiteAccessAlert } = await import('./WebsiteAccessAlert')

describe('WebsiteAccessAlert "Resume plan" (Vera B1)', () => {
  it('uses the pending-aware submit (disabled while the form submits)', () => {
    render(<WebsiteAccessAlert alert={{ status: 'ending', before: 'Your hosting is canceled. Your website stays online until ', date: 'Nov 3, 2026', after: '.', button: { kind: 'resume', label: 'Resume plan' } }} />)
    const btn = screen.getByRole('button', { name: 'Resume plan' })
    expect(btn).toHaveAttribute('data-testid', 'resume-plan-submit')
    expect(btn).toHaveAttribute('type', 'submit')
    expect(btn).toBeEnabled()
  })
})
