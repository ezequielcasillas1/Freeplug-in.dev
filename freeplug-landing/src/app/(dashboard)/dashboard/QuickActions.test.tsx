import { render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'

vi.mock('./billing-actions', () => ({ openBillingPortal: vi.fn() }))

import { QUICK_ACTIONS_GRID_3, QUICK_ACTIONS_GRID_4, QUICK_ACTIONS_LAST_OF_3, QuickActions } from './QuickActions'

const labels = () => [...screen.getByTestId('quick-actions').children].map((c) => c.textContent?.trim())

describe('Quick actions (round 11, Jace / Lina)', () => {
  it('four buttons: the layout is unchanged (2x2 on phone, one row of four on desktop)', () => {
    render(<QuickActions canManageBilling />)
    const grid = screen.getByTestId('quick-actions')
    expect(QUICK_ACTIONS_GRID_4).toBe('mb-8 grid grid-cols-2 gap-3 md:grid-cols-4')
    expect(grid.className).toBe(QUICK_ACTIONS_GRID_4)
    expect(labels()).toEqual(['Request a change', 'Upload photos', 'Set up my domain', 'Manage billing'])
    expect(screen.getByText('Set up my domain').className).not.toMatch(/col-span/)
    expect(screen.getByText('Manage billing').closest('form')).not.toBeNull()
  })

  it('regular customer without a Stripe customer: Manage billing still shown (link to Plans), unchanged', () => {
    render(<QuickActions canManageBilling={false} />)
    expect(screen.getByTestId('quick-actions').className).toBe(QUICK_ACTIONS_GRID_4)
    expect(screen.getByText('Manage billing').closest('a')?.getAttribute('href')).toBe('/dashboard/plans')
  })

  it('hidden: three buttons, phone 2 + 1 (domain spans row 2), desktop one row of three', () => {
    render(<QuickActions canManageBilling={false} showManageBilling={false} />)
    const grid = screen.getByTestId('quick-actions')
    expect(screen.queryByText('Manage billing')).toBeNull()
    expect(labels()).toEqual(['Request a change', 'Upload photos', 'Set up my domain'])
    expect(QUICK_ACTIONS_GRID_3).toBe('mb-8 grid grid-cols-2 gap-3 md:grid-cols-3')
    expect(grid.className).toBe(QUICK_ACTIONS_GRID_3)
    expect(QUICK_ACTIONS_LAST_OF_3).toBe('col-span-2 md:col-span-1')
    const domain = screen.getByText('Set up my domain')
    expect(domain.className.split(/\s+/)).toEqual(expect.arrayContaining(['col-span-2', 'md:col-span-1', 'w-full']))
    expect(screen.getByText('Request a change').className).not.toMatch(/col-span/)
    expect(screen.getByText('Upload photos').className).not.toMatch(/col-span/)
  })
})
