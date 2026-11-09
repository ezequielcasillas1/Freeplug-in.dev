import { render } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'

vi.mock('./actions', () => ({}))
vi.mock('next/navigation', () => ({ useRouter: () => ({ refresh: vi.fn(), push: vi.fn() }) }))

import { WeekendRepliesBadge, badgeHasWeekendReplies, filterCustomersByAccess, parseAccessFilter, type CustomerRowView } from './AdminCustomersTable'
import { adminPlanBadge } from '@/lib/plans/admin-badge'
import { entitlementsFor, PLAN_STEP_IDS } from '@/lib/plans/ladder'

const badgeFor = (id: (typeof PLAN_STEP_IDS)[number]) => adminPlanBadge(entitlementsFor({ stepId: id }))

describe('admin: plan -> "Weekend replies" badge', () => {
  it('no badge for Starter or no plan', () => {
    for (const b of [badgeFor('starter'), null, undefined]) {
      expect(badgeHasWeekendReplies(b)).toBe(false)
      expect(render(<WeekendRepliesBadge badge={b} />).container.textContent).toBe('')
    }
  })
  it('badge for Priority ($55) and every step above it', () => {
    for (const id of PLAN_STEP_IDS.filter((s) => s !== 'starter')) {
      const { getByTestId, unmount } = render(<WeekendRepliesBadge badge={badgeFor(id)} />)
      expect(getByTestId('weekend-replies-badge')).toHaveTextContent('Weekend replies')
      unmount()
    }
  })
  it('?access=weekend filters to those customers', () => {
    expect(parseAccessFilter('weekend')).toBe('weekend')
    const rows = [
      { id: 'a', planBadge: badgeFor('starter') },
      { id: 'b', planBadge: badgeFor('priority') },
      { id: 'c', planBadge: null },
      { id: 'd', planBadge: badgeFor('growth') },
    ] as unknown as CustomerRowView[]
    expect(filterCustomersByAccess(rows, 'weekend').map((r) => r.id)).toEqual(['b', 'd'])
  })
})
