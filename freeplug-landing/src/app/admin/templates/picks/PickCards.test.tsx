import { render, screen, within } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import { PickCards } from './PickCards'

describe('PickCards (admin picks below sm)', () => {
  const rows = [
    { id: 'a', business: 'Window QA Cleaning', status: 'submitted', type: 'cleaning', pick: 'Envato #28369624', canLock: true, canUnlock: true, note: null },
    { id: 'b', business: 'Locked Co', status: 'in_review', type: 'dental', pick: '72 After picks', canLock: false, canUnlock: false, note: 'Locked 10/13/2026' },
  ]
  it('name, then a spaced gray meta line, then full-width 44px buttons; hidden at sm+', () => {
    render(<PickCards rows={rows} lock={vi.fn()} unlock={vi.fn()} />)
    expect(screen.getByTestId('pick-cards').className).toContain('sm:hidden')
    const [a, b] = screen.getAllByTestId('pick-card')
    const meta = within(a).getByTestId('pick-card-meta')
    expect(meta.textContent).toBe('submitted · cleaning · Envato #28369624')
    expect(meta.className).toContain('text-zinc-500')
    for (const id of ['lock-pick-card', 'unlock-pick-card']) expect(within(a).getByTestId(id).className).toMatch(/min-h-\[44px\].*w-full/)
    expect(within(a).getByTestId('unlock-pick-card').textContent).toBe('Unlock for 1 hour')
    expect(within(b).queryByRole('button')).toBeNull()
    expect(b.textContent).toContain('Locked 10/13/2026')
  })
})
