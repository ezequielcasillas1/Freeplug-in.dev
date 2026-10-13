import { describe, expect, it, vi } from 'vitest'

const state: { user: { id: string } | null; row: { id: string } | null } = { user: { id: 'u1' }, row: { id: 'r' } }
vi.mock('next/navigation', () => ({ notFound: () => { throw new Error('NEXT_NOT_FOUND') } }))
vi.mock('@/lib/supabase/server', () => ({
  createClient: async () => ({
    auth: { getUser: async () => ({ data: { user: state.user } }) },
    from: () => { const q = { select: () => q, eq: () => q, maybeSingle: async () => ({ data: state.row }) }; return q },
  }),
}))
import TemplatePickerLayout from './layout'

const ID = '00000000-0000-4000-8000-00000000c0de'
const run = (id = ID) => TemplatePickerLayout({ children: 'ok', params: Promise.resolve({ id }) })

describe('picker layout: real 404 for non-owners (outside the loading boundary)', () => {
  it('owner passes through', async () => {
    state.user = { id: 'u1' }; state.row = { id: ID }
    expect(await run()).toBe('ok')
  })
  it('non-owner, anonymous and bad id call notFound()', async () => {
    state.row = null
    await expect(run()).rejects.toThrow('NEXT_NOT_FOUND')
    state.user = null; state.row = { id: ID }
    await expect(run()).rejects.toThrow('NEXT_NOT_FOUND')
    state.user = { id: 'u1' }
    await expect(run('nope')).rejects.toThrow('NEXT_NOT_FOUND')
  })
})
