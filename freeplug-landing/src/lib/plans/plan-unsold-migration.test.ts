import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'
import { PLAN_STEP_IDS } from './ladder'

const sql = readFileSync(join(__dirname, '..', '..', '..', 'supabase', 'migrations', '20261003190000_plan_unsold_purchases.sql'), 'utf8')

describe('20261003190000_plan_unsold_purchases.sql', () => {
  it('step CHECK matches ladder.ts', () => {
    const m = sql.match(/plan_step in \(([^)]+)\)/)
    expect(m?.[1].split(',').map((x) => x.trim().replace(/'/g, ''))).toEqual([...PLAN_STEP_IDS])
  })
  it('one row per Checkout Session; customers get nothing; RLS forced; no delete grant', () => {
    expect(sql).toContain('constraint plan_unsold_purchases_session_key unique (checkout_session_id)')
    expect(sql).toContain('force row level security')
    expect(sql).toContain('revoke all on table public.plan_unsold_purchases from public, anon, authenticated, service_role;')
    expect(sql).toContain('grant select, insert, update on table public.plan_unsold_purchases to service_role;')
    expect(sql).not.toMatch(/to authenticated|to anon|grant[^;]*delete/i)
  })
  it('idempotent statements only', () => {
    expect(sql).toMatch(/create table if not exists/)
    expect(sql).toMatch(/create index if not exists/)
    expect(sql).toMatch(/drop constraint if exists plan_unsold_purchases_plan_step_check/)
    expect(sql).not.toMatch(/create (or replace )?function/i)
  })
})
