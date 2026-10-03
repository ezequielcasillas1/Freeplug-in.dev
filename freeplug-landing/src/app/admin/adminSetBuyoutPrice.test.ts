import { beforeEach, describe, expect, it, vi } from 'vitest'

/**
 * adminSetBuyoutPrice: saves whole dollars as cents to buyout_price_cents, only on an is_buyout
 * row. The notes are never read (a "Buyout request (dashboard):" line doesn't count).
 */
type Row = { id: string; notes: string | null; is_buyout: boolean; buyout_price_cents: number | null }
const db: { rows: Row[]; updates: Record<string, unknown>[] } = { rows: [], updates: [] }

function fakeAdminClient() {
  return {
    from: () => {
      const filters: [string, unknown][] = []
      let selected: string | null = null
      let patch: Record<string, unknown> | null = null
      const match = () => db.rows.filter((r) => filters.every(([k, v]) => (r as Record<string, unknown>)[k] === v))
      const q = {
        select(cols: string) {
          selected = cols
          return q
        },
        update(p: Record<string, unknown>) {
          patch = p
          return q
        },
        eq(k: string, v: unknown) {
          filters.push([k, v])
          return q
        },
        async maybeSingle() {
          const r = match()[0]
          if (!r || !selected) return { data: null, error: null }
          return {
            data: Object.fromEntries(selected.split(',').map((c) => [c.trim(), (r as Record<string, unknown>)[c.trim()]])),
            error: null,
          }
        },
        then(resolve: (v: { error: null }) => void) {
          if (patch) {
            db.updates.push({ ...patch, filters: [...filters] })
            for (const r of match()) Object.assign(r, patch)
          }
          resolve({ error: null })
        },
      }
      return q
    },
  }
}

vi.mock('next/cache', () => ({ revalidatePath: vi.fn() }))
vi.mock('@/lib/admin/guard', () => ({ assertAdminAccess: vi.fn(async () => undefined) }))
vi.mock('@/lib/admin/mail', () => ({ sendAdminMail: vi.fn() }))
vi.mock('@/lib/supabase/admin', () => ({ createAdminClient: () => fakeAdminClient() }))

const { adminSetBuyoutPrice } = await import('./actions')

const BUYOUT_ID = '11111111-1111-4111-8111-111111111111'
const NORMAL_ID = '22222222-2222-4222-8222-222222222222'
const PASTED_ID = '33333333-3333-4333-8333-333333333333'

beforeEach(() => {
  db.updates = []
  db.rows = [
    { id: BUYOUT_ID, notes: 'customer removed the buyout line', is_buyout: true, buyout_price_cents: null },
    { id: NORMAL_ID, notes: 'Please update our hours.', is_buyout: false, buyout_price_cents: null },
    { id: PASTED_ID, notes: 'Buyout request (dashboard):\nRequested: pasted', is_buyout: false, buyout_price_cents: null },
  ]
})

describe('adminSetBuyoutPrice', () => {
  it('saves the price in cents on an is_buyout row (even with no notes line)', async () => {
    expect(await adminSetBuyoutPrice(BUYOUT_ID, '1,200')).toEqual({ ok: true })
    expect(db.rows[0].buyout_price_cents).toBe(120_000)
    expect(db.rows[0].notes).toBe('customer removed the buyout line')
    expect(db.updates[0]).toMatchObject({ buyout_price_cents: 120_000 })
    expect(db.updates[0].filters).toContainEqual(['is_buyout', true])
    expect(Object.keys(db.updates[0])).not.toContain('notes')
  })

  it('refuses a non-buyout row', async () => {
    expect(await adminSetBuyoutPrice(NORMAL_ID, '500')).toEqual({ ok: false, error: 'Not a buyout request' })
    expect(db.updates).toHaveLength(0)
  })

  it('refuses a normal row whose notes contain the pasted buyout line', async () => {
    expect(await adminSetBuyoutPrice(PASTED_ID, '500')).toEqual({ ok: false, error: 'Not a buyout request' })
    expect(db.updates).toHaveLength(0)
  })

  it('validates the input on the server', async () => {
    expect(await adminSetBuyoutPrice(BUYOUT_ID, '12.50')).toEqual({
      ok: false,
      error: 'Use whole dollars from 1 to 500,000.',
    })
    expect(await adminSetBuyoutPrice('not-a-uuid', '500')).toEqual({ ok: false, error: 'Invalid request id' })
    expect(db.updates).toHaveLength(0)
  })
})
