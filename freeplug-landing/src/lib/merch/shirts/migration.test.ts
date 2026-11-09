import { readFileSync } from 'node:fs'
import path from 'node:path'
import { describe, expect, it } from 'vitest'

const sql = readFileSync(
  path.join(__dirname, '../../../../supabase/migrations/20261108180000_merch_shirt_orders.sql'),
  'utf8'
)

describe('merch_shirt_orders migration', () => {
  it('is service_role only with RLS enabled', () => {
    expect(sql).toMatch(/enable row level security/)
    expect(sql).toMatch(/grant select, insert, update, delete on table public\.merch_shirt_orders to service_role/)
    expect(sql).toMatch(/revoke all on table public\.merch_shirt_orders from anon/)
  })
})
