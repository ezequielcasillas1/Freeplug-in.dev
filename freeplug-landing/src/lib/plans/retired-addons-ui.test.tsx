import { render, screen } from '@testing-library/react'
import { readFileSync } from 'node:fs'
import path from 'node:path'
import { describe, expect, it, vi } from 'vitest'

vi.mock('@/app/(dashboard)/dashboard/billing-actions', () => ({ openBillingPortal: vi.fn() }))

import { HostingCheckoutCard } from '@/components/plans/HostingCheckoutCard'
import * as copy from './ladder-copy'

describe('old "+1 small edit" / "Big change" UI is gone (Oct 18)', () => {
  it('plan cards show the new edit lines and no retired add-on switch or charge note', () => {
    const { container } = render(<HostingCheckoutCard />)
    expect(container.querySelector('[data-addon="small_edit"]')).toBeNull()
    expect(container.querySelector('[data-addon="big_change"]')).toBeNull()
    expect(container.querySelector('[data-testid="addon-charge-note"]')).toBeNull()
    expect(container.querySelector('[data-testid="addon-bigger-note"]')).toBeNull()
    expect(screen.queryByText(/Big change/)).toBeNull()
    expect(screen.queryByText(/\+1 small edit/)).toBeNull()
    expect(screen.getByText('2 edits a month: small changes like hours, a photo swap or a price change.')).toBeTruthy()
    expect(screen.getByText('New pages or features are quoted as one-time maintenance.')).toBeTruthy()
  })
  it('admin row has no "Mark as big change" button and the copy exports are removed', () => {
    const row = readFileSync(path.join(__dirname, '../../app/admin/AdminRequestRow.tsx'), 'utf8')
    expect(row).not.toMatch(/admin-mark-big-change|adminMarkBigChange|Mark as big change/)
    expect('ADMIN_MARK_BIG_CHANGE' in copy).toBe(false)
    expect('bigChangeLine' in copy).toBe(false)
    expect('BIG_CHANGE_BIGGER_NOTE' in copy).toBe(false)
    expect('addonChargeNote' in copy).toBe(false)
  })
})
