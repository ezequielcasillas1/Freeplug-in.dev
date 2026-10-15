// @vitest-environment node
import { beforeEach, describe, expect, it, vi } from 'vitest'

// Phase 5 L-3: each admin change-request page checks admin access itself, before any service-role query.
const h = vi.hoisted(() => ({ allowed: false, adminClients: 0 }))
vi.mock('@/lib/admin/guard', () => ({
  assertAdminAccess: async () => {
    if (!h.allowed) throw new Error('NEXT_NOT_FOUND')
  },
}))
vi.mock('@/lib/supabase/admin', () => ({
  createAdminClient: () => {
    h.adminClients++
    const q: Record<string, unknown> = {}
    for (const m of ['from', 'select', 'order', 'eq']) q[m] = () => q
    q.limit = async () => ({ data: [], error: null })
    q.maybeSingle = async () => ({ data: null, error: null })
    return q
  },
}))

import ListPage from './page'
import DetailPage from './[id]/page'

const ID = '6f1c2a9e-3b7d-4e8a-9c41-2d5f8a7b0c13'

describe('admin change-request pages: own admin check (phase 5 L-3)', () => {
  beforeEach(() => {
    h.allowed = false
    h.adminClients = 0
  })
  it('list page: a non-admin gets notFound and no service-role client is created', async () => {
    await expect(ListPage()).rejects.toThrow('NEXT_NOT_FOUND')
    expect(h.adminClients).toBe(0)
  })
  it('detail page: a non-admin gets notFound and no service-role client is created', async () => {
    await expect(DetailPage({ params: Promise.resolve({ id: ID }) })).rejects.toThrow('NEXT_NOT_FOUND')
    expect(h.adminClients).toBe(0)
  })
  it('an admin gets through to the query', async () => {
    h.allowed = true
    await ListPage()
    expect(h.adminClients).toBe(1)
  })
})
