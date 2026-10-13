// @vitest-environment node
import { beforeEach, describe, expect, it, vi } from 'vitest'

const calls: Array<[string, ...unknown[]]> = []
const guard = vi.fn()
vi.mock('./guard', () => ({ assertTemplatesAccess: () => guard() }))
vi.mock('next/cache', () => ({ revalidatePath: vi.fn() }))
vi.mock('@/lib/supabase/admin', () => ({
  createAdminClient: () => {
    const q: Record<string, (...a: unknown[]) => unknown> = {}
    for (const m of ['from', 'update', 'eq', 'is', 'not']) q[m] = (...a: unknown[]) => { calls.push([m, ...a]); return q }
    ;(q as unknown as { then: unknown }).then = (r: (v: unknown) => void) => r({ error: null })
    return q
  },
}))
import { lockTemplatePickAction } from './lock-actions'

const ID = '00000000-0000-4000-8000-00000000c0de'
const form = (id: string) => { const f = new FormData(); f.set('request_id', id); return f }

describe('lockTemplatePickAction', () => {
  beforeEach(() => { calls.length = 0; guard.mockReset() })
  it('is admin-only: a failed guard stops before any write', async () => {
    guard.mockRejectedValue(new Error('NEXT_NOT_FOUND'))
    await expect(lockTemplatePickAction(form(ID))).rejects.toThrow('NEXT_NOT_FOUND')
    expect(calls).toHaveLength(0)
  })
  it('sets template_locked_at once, only on rows with a pick', async () => {
    guard.mockResolvedValue('lina@example.test')
    await lockTemplatePickAction(form(ID))
    expect(calls[0]).toEqual(['from', 'website_requests'])
    expect(Object.keys(calls[1][1] as object)).toEqual(['template_locked_at'])
    expect(calls).toContainEqual(['eq', 'id', ID])
    expect(calls).toContainEqual(['is', 'template_locked_at', null])
    expect(calls).toContainEqual(['not', 'template_choice', 'is', null])
  })
  it('refuses a malformed id', async () => {
    guard.mockResolvedValue('lina@example.test')
    await expect(lockTemplatePickAction(form('x'))).rejects.toThrow()
    expect(calls).toHaveLength(0)
  })
})
