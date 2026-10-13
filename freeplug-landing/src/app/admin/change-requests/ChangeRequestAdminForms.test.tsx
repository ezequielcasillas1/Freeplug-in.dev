import { fireEvent, render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'

vi.mock('./actions', () => ({
  adminDecideChangeRequest: vi.fn(async () => ({})),
  adminResendChangeRequest: vi.fn(async () => ({})),
}))
import { ChangeRequestDecisionForm } from './ChangeRequestAdminForms'

describe('Approve / Decline confirm step (Aria ruling 5)', () => {
  it('Approve does not submit; it opens a labelled confirm dialog and moves focus into it', () => {
    render(<ChangeRequestDecisionForm id="x" />)
    const approve = screen.getByRole('button', { name: 'Approve' })
    expect(approve).toHaveAttribute('type', 'button')
    expect(screen.queryByRole('alertdialog')).toBeNull()
    fireEvent.click(approve)
    const dlg = screen.getByRole('alertdialog', { name: 'Approve this change request?' })
    expect(dlg).toHaveAccessibleDescription(/charges nothing and starts no work/)
    expect(document.activeElement).toBe(screen.getByRole('heading', { name: 'Approve this change request?' }))
    expect(approve).toHaveAttribute('aria-expanded', 'true')
    const yes = screen.getByRole('button', { name: 'Yes, approve' })
    expect(yes).toHaveAttribute('type', 'submit')
    expect(yes).toHaveAttribute('name', 'decision')
    expect(yes).toHaveAttribute('value', 'approved')
    expect(dlg.querySelector('input[name="confirmed"]')).toHaveAttribute('value', 'yes')
  })
  it('Decline confirm says what the customer sees; Cancel closes it', () => {
    render(<ChangeRequestDecisionForm id="x" />)
    fireEvent.click(screen.getByRole('button', { name: 'Decline' }))
    expect(screen.getByRole('alertdialog', { name: 'Decline this change request?' })).toHaveAccessibleDescription(/Not approved/)
    expect(screen.getByRole('button', { name: 'Yes, decline' })).toHaveAttribute('value', 'declined')
    fireEvent.click(screen.getByRole('button', { name: 'Cancel' }))
    expect(screen.queryByRole('alertdialog')).toBeNull()
    expect(document.querySelector('input[name="confirmed"]')).toBeNull()
  })
  it('Escape closes the confirm step', () => {
    render(<ChangeRequestDecisionForm id="x" />)
    fireEvent.click(screen.getByRole('button', { name: 'Approve' }))
    fireEvent.keyDown(screen.getByRole('alertdialog'), { key: 'Escape' })
    expect(screen.queryByRole('alertdialog')).toBeNull()
  })
})
