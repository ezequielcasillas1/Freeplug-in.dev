import { beforeEach, describe, expect, it, vi } from 'vitest'

const db = vi.hoisted(() => ({
  status: 'pending_review' as string,
  updates: [] as { table: string; patch: Record<string, unknown>; filters: Record<string, unknown> }[],
  tables: [] as string[],
}))
const guard = vi.hoisted(() => ({ allowed: true }))
vi.mock('@/lib/admin/guard', () => ({
  assertAdminAccess: async () => {
    if (!guard.allowed) throw new Error('NEXT_NOT_FOUND')
  },
}))
vi.mock('next/cache', () => ({ revalidatePath: () => {} }))
vi.mock('@/lib/supabase/admin', () => ({
  createAdminClient: () => ({
    from: (table: string) => {
      db.tables.push(table)
      const filters: Record<string, unknown> = {}
      let patch: Record<string, unknown> = {}
      const q = {
        update: (p: Record<string, unknown>) => ((patch = p), q),
        eq: (k: string, v: unknown) => ((filters[k] = v), q),
        select: () => q,
        maybeSingle: async () => {
          db.updates.push({ table, patch, filters })
          // The status filter: only a pending row is updated.
          if (filters.status === 'pending_review' && db.status !== 'pending_review') return { data: null, error: null }
          db.status = String(patch.status ?? db.status)
          return { data: { id: filters.id }, error: null }
        },
      }
      return q
    },
  }),
}))
const deliver = vi.hoisted(() => ({ calls: [] as unknown[], result: { ok: true, status: 200 } as Record<string, unknown> }))
vi.mock('@/lib/change-requests/notify', () => ({
  deliverChangeRequest: async (_admin: unknown, id: string) => {
    deliver.calls.push(id)
    return deliver.result
  },
}))

import { adminDecideChangeRequest, adminResendChangeRequest } from './actions'

const ID = '6f1c2a9e-3b7d-4e8a-9c41-2d5f8a7b0c13'
const form = (v: Record<string, string>) => {
  const f = new FormData()
  for (const [k, val] of Object.entries(v)) f.set(k, val)
  return f
}

describe('admin Approve / Decline (Ezequiel\'s PR verdict)', () => {
  beforeEach(() => {
    db.status = 'pending_review'
    db.updates = []
    db.tables = []
    guard.allowed = true
  })

  it('Approve records status, decided_at and the PR link; touches only change_requests (no charge, no edit use)', async () => {
    const r = await adminDecideChangeRequest({}, form({ id: ID, decision: 'approved', note: '', pr_url: 'https://github.com/72after/freeplug/pull/41' }))
    expect(r).toEqual({ ok: true, message: 'Marked approved.' })
    expect(db.tables).toEqual(['change_requests'])
    const u = db.updates[0]
    expect(u.filters).toEqual({ id: ID, status: 'pending_review' })
    expect(u.patch).toMatchObject({ status: 'approved', decision_note: null, pr_url: 'https://github.com/72after/freeplug/pull/41' })
    expect(Date.parse(String(u.patch.decided_at))).not.toBeNaN()
  })

  it('Decline with a note', async () => {
    const r = await adminDecideChangeRequest({}, form({ id: ID, decision: 'declined', note: '  That page is not on your site yet. ', pr_url: '' }))
    expect(r.ok).toBe(true)
    expect(db.updates[0].patch).toMatchObject({ status: 'declined', decision_note: 'That page is not on your site yet.', pr_url: null })
  })

  it('a decided request cannot be decided again', async () => {
    await adminDecideChangeRequest({}, form({ id: ID, decision: 'approved', note: '', pr_url: '' }))
    const r = await adminDecideChangeRequest({}, form({ id: ID, decision: 'declined', note: '', pr_url: '' }))
    expect(r.error).toMatch(/already decided/)
    expect(db.status).toBe('approved')
  })

  it.each([
    [{ id: 'nope', decision: 'approved', note: '', pr_url: '' }, /Invalid request id/],
    [{ id: ID, decision: 'maybe', note: '', pr_url: '' }, /Approve or Decline/],
    [{ id: ID, decision: 'declined', note: 'x'.repeat(501), pr_url: '' }, /500/],
    [{ id: ID, decision: 'approved', note: '', pr_url: 'https://evil.example/pull/1' }, /github\.com/],
    [{ id: ID, decision: 'approved', note: '', pr_url: 'javascript:alert(1)' }, /github\.com/],
  ])('refuses bad input %#', async (input, msg) => {
    const r = await adminDecideChangeRequest({}, form(input))
    expect(r.error).toMatch(msg)
    expect(db.updates).toEqual([])
  })

  it('admin only: the guard runs first', async () => {
    guard.allowed = false
    await expect(adminDecideChangeRequest({}, form({ id: ID, decision: 'approved', note: '', pr_url: '' }))).rejects.toThrow('NEXT_NOT_FOUND')
    await expect(adminResendChangeRequest({}, form({ id: ID }))).rejects.toThrow('NEXT_NOT_FOUND')
    expect(db.updates).toEqual([])
    expect(deliver.calls).toEqual([])
  })
})

describe('admin Resend', () => {
  beforeEach(() => {
    deliver.calls = []
    guard.allowed = true
  })
  it('sends once and reports the result', async () => {
    deliver.result = { ok: true, status: 202 }
    expect(await adminResendChangeRequest({}, form({ id: ID }))).toEqual({ ok: true, message: 'Sent (HTTP 202).' })
    deliver.result = { ok: false, error: 'HTTP 500' }
    expect(await adminResendChangeRequest({}, form({ id: ID }))).toEqual({ error: 'Not sent: HTTP 500' })
    deliver.result = { ok: false, skipped: true, error: 'Not sent: webhook not configured' }
    expect(await adminResendChangeRequest({}, form({ id: ID }))).toEqual({ error: 'Not sent: webhook not configured' })
    expect(deliver.calls).toEqual([ID, ID, ID])
  })
})
