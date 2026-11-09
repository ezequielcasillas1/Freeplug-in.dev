import { readFileSync } from 'node:fs'
import path from 'node:path'
import { describe, expect, it } from 'vitest'

const sql = readFileSync(
  path.join(__dirname, '../../../../supabase/migrations/20261109120000_merch_shop_orders.sql'),
  'utf8'
)

describe('merch_shop_orders migration', () => {
  it('restricts table to service role and sets pending_review default', () => {
    expect(sql).toMatch(/status text not null default 'pending_review'/)
    expect(sql).toMatch(/moderation_result text/)
    expect(sql).toMatch(/rights_accepted_at timestamptz/)
    expect(sql).toMatch(/20971520/)
    expect(sql).toMatch(/grant select, insert, update, delete on table public\.merch_shop_orders to service_role/)
    expect(sql).toMatch(/revoke all on table public\.merch_shop_orders from anon/)
  })
})
