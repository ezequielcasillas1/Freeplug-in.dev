import { readFileSync } from 'node:fs'
import path from 'node:path'
import { describe, expect, it } from 'vitest'

const sql = readFileSync(
  path.join(__dirname, '../../../../supabase/migrations/20261108210000_merch_collection_orders.sql'),
  'utf8'
)

describe('merch_collection_orders migration', () => {
  it('service role only', () => {
    expect(sql).toMatch(/grant select, insert, update, delete on table public\.merch_collection_orders to service_role/)
    expect(sql).toMatch(/revoke all on table public\.merch_collection_orders from anon/)
  })
})
