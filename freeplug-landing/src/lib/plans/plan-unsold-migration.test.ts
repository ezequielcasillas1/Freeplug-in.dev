import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'
import { PLAN_STEP_IDS } from './ladder'

const createSql = readFileSync(join(__dirname, '..', '..', '..', 'supabase', 'migrations', '20261003190000_plan_unsold_purchases.sql'), 'utf8')
const stepSql = readFileSync(join(__dirname, '..', '..', '..', 'supabase', 'migrations', '20261109130000_plug_authority_plan_step.sql'), 'utf8')

describe('20261003190000_plan_unsold_purchases.sql', () => {
  it('one row per Checkout Session; customers get nothing; RLS forced; no delete grant', () => {
    expect(createSql).toContain('constraint plan_unsold_purchases_session_key unique (checkout_session_id)')
    expect(createSql).toContain('force row level security')
    expect(createSql).toContain('revoke all on table public.plan_unsold_purchases from public, anon, authenticated, service_role;')
    expect(createSql).toContain('grant select, insert, update on table public.plan_unsold_purchases to service_role;')
    expect(createSql).not.toMatch(/to authenticated|to anon|grant[^;]*delete/i)
  })
  it('idempotent statements only', () => {
    expect(createSql).toMatch(/create table if not exists/)
    expect(createSql).toMatch(/create index if not exists/)
    expect(createSql).toMatch(/drop constraint if exists plan_unsold_purchases_plan_step_check/)
    expect(createSql).not.toMatch(/create (or replace )?function/i)
  })
})

describe('plan_unsold_purchases plan_step CHECK (latest migration)', () => {
  it('matches ladder.ts', () => {
    const m = stepSql.match(/plan_unsold_purchases_plan_step_check[^;]*plan_step in \(([^)]+)\)/)
    expect(m?.[1].split(',').map((x) => x.trim().replace(/'/g, ''))).toEqual([...PLAN_STEP_IDS])
  })
})
