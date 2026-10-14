// @vitest-environment node
import { beforeEach, describe, expect, it, vi } from 'vitest'

const calls: Array<[string, ...unknown[]]> = []
const guard = vi.fn()
vi.mock('./guard', () => ({ assertTemplatesAccess: () => guard() }))
vi.mock('next/cache', () => ({ revalidatePath: vi.fn() }))
vi.mock('@/lib/supabase/admin', () => ({
  createAdminClient: () => ({
    rpc: async (...a: unknown[]) => { calls.push(['rpc', ...a]); return { data: null, error: null } },
    from: (...a: unknown[]) => { calls.push(['from', ...a]); throw new Error('direct table write not allowed') },
  }),
}))
import { lockTemplatePickAction, unlockTemplatePickAction } from './lock-actions'

const ID = '00000000-0000-4000-8000-00000000c0de'
const form = (id: string) => { const f = new FormData(); f.set('request_id', id); return f }

describe.each([
  ['lockTemplatePickAction', lockTemplatePickAction, 'template_pick_admin_lock'],
  ['unlockTemplatePickAction', unlockTemplatePickAction, 'template_pick_admin_unlock'],
] as const)('%s', (_n, action, rpc) => {
  beforeEach(() => { calls.length = 0; guard.mockReset() })
  it('is admin-only: a failed guard stops before any write', async () => {
    guard.mockRejectedValue(new Error('NEXT_NOT_FOUND'))
    await expect(action(form(ID))).rejects.toThrow('NEXT_NOT_FOUND')
    expect(calls).toHaveLength(0)
  })
  it('goes through the atomic RPC that also writes the audit row, with the admin as actor', async () => {
    guard.mockResolvedValue('lina@example.test')
    await action(form(ID))
    expect(calls).toEqual([['rpc', rpc, { p_request_id: ID, p_actor_email: 'lina@example.test' }]])
  })
  it('refuses a malformed id', async () => {
    guard.mockResolvedValue('lina@example.test')
    await expect(action(form('x'))).rejects.toThrow()
    expect(calls).toHaveLength(0)
  })
})
