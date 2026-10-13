import { describe, expect, it } from 'vitest'
import { supabaseBuyoutStore } from './supabase-store'
import type { SupabaseClient } from '@supabase/supabase-js'

/** The server store sets is_buyout itself (service-role client); it is the only buyout signal. */
function recordingClient(result: { data?: unknown; error?: unknown } = { data: [{ id: 'r1' }], error: null }) {
  const calls: { op: string; payload?: unknown; filters: unknown[] }[] = []
  const client = {
    from() {
      const call: { op: string; payload?: unknown; filters: unknown[] } = { op: 'select', filters: [] }
      calls.push(call)
      const q: Record<string, unknown> = {
        select: () => q,
        update: (p: unknown) => ((call.op = 'update'), (call.payload = p), q),
        insert: (p: unknown) => ((call.op = 'insert'), (call.payload = p), Promise.resolve({ error: null })),
        eq: (...a: unknown[]) => (call.filters.push(['eq', ...a]), q),
        in: (...a: unknown[]) => (call.filters.push(['in', ...a]), q),
        order: () => q,
        limit: () => q,
        maybeSingle: () => Promise.resolve({ data: null, error: null }),
        then: (resolve: (v: unknown) => void) => resolve(result),
      }
      return q
    },
  }
  return { client: client as unknown as SupabaseClient, calls }
}

describe('supabaseBuyoutStore', () => {
  it('markBuyoutIfUnchanged sets is_buyout = true with the notes, guarded by updated_at', async () => {
    const { client, calls } = recordingClient()
    const ok = await supabaseBuyoutStore(client).markBuyoutIfUnchanged(
      { id: 'r1', notes: 'x', updated_at: 't0', is_buyout: false },
      'x\n\nBuyout request (dashboard):',
      new Date('2026-09-25T20:00:00Z')
    )
    expect(ok).toBe(true)
    expect(calls[0].payload).toMatchObject({ is_buyout: true })
    expect(calls[0].filters).toContainEqual(['eq', 'updated_at', 't0'])
  })

  it('insertRequest creates the request with is_buyout = true', async () => {
    const { client, calls } = recordingClient()
    const res = await supabaseBuyoutStore(client).insertRequest(
      'u1',
      { business_name: 'Tacos Kyle', contact_phone: null, google_business_url: null },
      'Buyout request (dashboard):'
    )
    expect(res).toBe('ok')
    expect(calls[0].payload).toMatchObject({ user_id: 'u1', status: 'submitted', is_buyout: true })
  })
})
