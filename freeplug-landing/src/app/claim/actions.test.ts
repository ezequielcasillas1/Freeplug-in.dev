// @vitest-environment node
import { describe, expect, it, vi } from 'vitest'

const saveChosenPlan = vi.fn()
vi.mock('@/lib/supabase/server', () => ({
  createClient: async () => ({ auth: { getUser: async () => ({ data: { user: { id: 'u1', email: 'u1@example.test' } } }) } }),
}))
vi.mock('@/lib/outreach/server', () => ({
  saveChosenPlan: (...a: unknown[]) => saveChosenPlan(...a),
  confirmCustomerDetails: vi.fn(),
  startSetupCheckout: vi.fn(),
  uploadCustomerPhoto: vi.fn(),
}))

import { saveClaimPlanAction } from './actions'
import { STEP_NOT_SELLABLE_MESSAGE } from '@/lib/plans/ladder-copy'

describe('saveClaimPlanAction (claim step 3, server action)', () => {
  it('passes the raw input to the server check and explains a not_sellable refusal', async () => {
    saveChosenPlan.mockResolvedValue({ ok: false, code: 'not_sellable', error: 'not_sellable' })
    expect(await saveClaimPlanAction({ planStep: 'leads' })).toBe(STEP_NOT_SELLABLE_MESSAGE('Leads'))
    expect(saveChosenPlan).toHaveBeenCalledWith('u1', { planStep: 'leads' })
  })
  it('null on success', async () => {
    saveChosenPlan.mockResolvedValue({ ok: true })
    expect(await saveClaimPlanAction({ planStep: 'starter' })).toBeNull()
  })
})
