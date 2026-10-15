import { render } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'

vi.mock('./actions', () => ({}))
vi.mock('next/navigation', () => ({ useRouter: () => ({ refresh: vi.fn(), push: vi.fn() }) }))

import { AdminStepBadge } from './AdminCustomersTable'
import { adminPlanBadge } from '@/lib/plans/admin-badge'
import { entitlementsFor } from '@/lib/plans/ladder'

describe('AdminStepBadge (admin only; hosting ladder)', () => {
  it('shows the step name, highlighted from Priority up', () => {
    const { container } = render(<AdminStepBadge badge={adminPlanBadge(entitlementsFor({ stepId: 'growth' }))} />)
    const el = container.querySelector('[data-plan-step="growth"]')!
    expect(el).toHaveTextContent('Growth partner')
    expect(el.className).toContain('ba3d3d')
  })

  it('Starter is a plain badge; legacy plans say "(legacy)"; no plan, no badge', () => {
    const a = render(<AdminStepBadge badge={adminPlanBadge(entitlementsFor({ stepId: 'starter' }))} />)
    expect(a.container.querySelector('[data-plan-step="starter"]')!.className).toContain('zinc')
    const b = render(<AdminStepBadge badge={adminPlanBadge(entitlementsFor({ legacy: { hostingCents: 3500, addonTier: 'pro' } }))} />)
    expect(b.container).toHaveTextContent('Starter (legacy)')
    const c = render(<AdminStepBadge badge={null} />)
    expect(c.container).toBeEmptyDOMElement()
  })
})
