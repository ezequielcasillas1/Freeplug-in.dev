import { fireEvent, render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { ChangeRequestsCard } from './ChangeRequestsCard'
import { looksLong } from './ChangeRequestText'
import { CHANGE_REQUEST_COPY_KEYS, CHANGE_REQUEST_SHOW_ALL, CHANGE_REQUEST_SHOW_LESS } from '@/lib/change-requests/copy'

const row = (description: string, extra: Record<string, unknown> = {}) => ({
  id: 'r1', change_type: 'Text or prices', page: 'Services', description, status: 'pending_review',
  decision_note: null, decided_at: null, created_at: '2026-10-10T20:00:00.000Z', ...extra,
})
const LONG = 'Please update the services page. '.repeat(14)

describe('long request text (Lina, Oct 10)', () => {
  it("Sable's words, one key each", () => {
    expect(CHANGE_REQUEST_SHOW_ALL).toBe('Show all')
    expect(CHANGE_REQUEST_SHOW_LESS).toBe('Show less')
    expect(CHANGE_REQUEST_COPY_KEYS.showAll).toBe('changeRequests.showAll')
    expect(CHANGE_REQUEST_COPY_KEYS.showLess).toBe('changeRequests.showLess')
  })
  it('short text: whole text, no 2-line clamp, no button', () => {
    render(<ChangeRequestsCard requests={[row('Change the phone number.') as never]} />)
    const p = screen.getByTestId('change-request-text')
    expect(p.className).not.toMatch(/line-clamp-2/)
    expect(screen.queryByRole('button')).toBeNull()
  })
  it('long text: clamped at 6 lines with an accessible Show all / Show less toggle', () => {
    render(<ChangeRequestsCard requests={[row(LONG) as never]} />)
    const p = screen.getByTestId('change-request-text')
    expect(p).toHaveTextContent(LONG.trim())
    expect(p.className).toMatch(/line-clamp-6/)
    const btn = screen.getByRole('button', { name: 'Show all' })
    expect(btn).toHaveAttribute('aria-expanded', 'false')
    expect(btn).toHaveAttribute('aria-controls', p.id)
    fireEvent.click(btn)
    expect(screen.getByRole('button', { name: 'Show less' })).toHaveAttribute('aria-expanded', 'true')
    expect(p.className).not.toMatch(/line-clamp/)
    fireEvent.click(screen.getByRole('button', { name: 'Show less' }))
    expect(screen.getByRole('button', { name: 'Show all' })).toHaveAttribute('aria-expanded', 'false')
  })
  it('keeps line breaks; many short lines count as long', () => {
    expect(looksLong('a\nb\nc\nd\ne\nf\ng')).toBe(true)
    expect(looksLong('a\nb')).toBe(false)
    render(<ChangeRequestsCard requests={[row('line one\nline two') as never]} />)
    expect(screen.getByTestId('change-request-text').className).toMatch(/whitespace-pre-wrap/)
  })
  it('"Our note:" reads as our reply: 2px gray left border with left padding', () => {
    render(<ChangeRequestsCard requests={[row('x', { status: 'declined', decision_note: 'Only hours.' }) as never]} />)
    const d = screen.getByTestId('change-request-detail')
    expect(d).toHaveTextContent('Our note: Only hours.')
    expect(d.className).toMatch(/border-l-2/)
    expect(d.className).toMatch(/border-gray-300/)
    expect(d.className).toMatch(/pl-3/)
  })
})
