import { render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'

vi.mock('./actions', () => ({ adminMarkSmallEdit: vi.fn(), adminSetWebsiteRequestStatus: vi.fn() }))
vi.mock('./AdminQuickEmail', () => ({ AdminQuickEmail: () => null }))

import { AdminRequestRow } from './AdminRequestRow'

describe('admin request statuses', () => {
  it('offers the full consultation flow', () => {
    render(
      <table><tbody>
        <AdminRequestRow
          mailConfigured={false}
          row={{ id: 'r', user_id: 'u', business_name: 'B', contact_phone: null, google_business_url: null, notes: null, buyout_price_cents: null, is_buyout: false, status: 'consultation', created_at: '2026-10-22T00:00:00Z', updated_at: '2026-10-22T00:00:00Z', userEmail: null, userDisplayName: null }}
        />
      </tbody></table>
    )
    const opts = screen.getAllByRole('option').map((o) => o.textContent)
    expect(opts).toEqual(['Submitted', 'In review', 'Consultation', 'Agreed', 'Building', 'Closed'])
    expect((screen.getByRole('combobox') as HTMLSelectElement).value).toBe('consultation')
  })
})
