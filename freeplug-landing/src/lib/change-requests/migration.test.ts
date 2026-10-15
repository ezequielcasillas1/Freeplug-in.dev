// @vitest-environment node
import { readFileSync } from 'node:fs'
import path from 'node:path'
import { describe, expect, it } from 'vitest'

/**
 * Static checks on 20261004150000_change_requests.sql (no database). Behaviour (RLS denials, grants,
 * double apply) was run on a throwaway Postgres 17: /workspace/owen/change-req-pgtest/run-throwaway.sh.
 */
const FILE = '20261004150000_change_requests.sql'
const sql = readFileSync(path.resolve(__dirname, '../../../supabase/migrations', FILE), 'utf8').toLowerCase()
const code = sql.replace(/--.*$/gm, '')

describe(FILE, () => {
  it('sorts after 20261004120000', () => {
    expect(FILE.slice(0, 14) > '20261004120000').toBe(true)
  })

  it('is idempotent DDL', () => {
    expect(code).toContain('create table if not exists public.change_requests')
    expect(code).not.toMatch(/create (table|index) (?!if not exists)/)
    expect(code.match(/create policy/g)?.length).toBe(code.match(/if not exists \(\s*select 1 from pg_policies/g)?.length)
    expect(code.match(/add constraint (\w+)/g)?.length).toBe(code.match(/drop constraint if exists/g)?.length)
  })

  it('has the spec columns and checks', () => {
    for (const col of [
      'id uuid primary key default gen_random_uuid()',
      'user_id uuid not null default auth.uid() references auth.users (id) on delete cascade',
      'website_request_id uuid null references public.website_requests (id) on delete set null',
      'change_type text not null', 'page text not null', 'description text not null', 'photo_name text null', 'plan_step text null',
      "billing text not null default 'unknown'", "status text not null default 'pending_review'",
      'decision_note text null', 'decided_at timestamptz null', 'notified_at timestamptz null', 'notify_error text null',
      'created_at timestamptz not null default now()', 'updated_at timestamptz not null default now()',
    ]) {
      expect(code).toContain(col)
    }
    expect(code).toContain("check (billing in ('included', 'paid_addon', 'quote', 'unknown'))")
    expect(code).toContain("check (status in ('pending_review', 'approved', 'declined'))")
    expect(code).toContain('char_length(btrim(page)) between 1 and 200')
    expect(code).toContain('char_length(btrim(description)) between 1 and 2000')
    expect(code).toContain('char_length(decision_note) <= 500')
    expect(code).not.toMatch(/\b(email|phone|contact_phone|stripe_\w+|ip|ip_address)\b\s+(text|inet)/)
  })

  it('RLS: forced; customer select own + insert own (pending only); no customer update or delete', () => {
    expect(code).toContain('alter table public.change_requests enable row level security')
    expect(code).toContain('alter table public.change_requests force row level security')
    expect(code).toContain('revoke all on table public.change_requests from public, anon, authenticated, service_role')
    expect(code).toContain('grant insert (website_request_id, change_type, page, description, photo_name) on table public.change_requests to authenticated')
    expect(code).toContain('grant select, insert, update on table public.change_requests to service_role')
    expect(code).not.toMatch(/grant [^;]*\b(update|delete)\b[^;]*to authenticated/)
    expect(code).not.toMatch(/grant [^;]*to anon/)
    expect(code).not.toMatch(/grant [^;]*\bdelete\b[^;]*to service_role/)
    expect(code).toMatch(/create policy change_requests_select_own on public.change_requests\s+for select to authenticated using \(auth.uid\(\) = user_id\)/)
    const insert = code.slice(code.indexOf('create policy change_requests_insert_own'), code.indexOf('create policy change_requests_service_role_all'))
    for (const c of ["status = 'pending_review'", "billing = 'unknown'", 'decision_note is null', 'decided_at is null', 'notified_at is null', 'notify_error is null', 'pr_url is null', 'auth.uid() = user_id']) {
      expect(insert).toContain(c)
    }
    expect(code).not.toMatch(/for (update|delete|all) to authenticated/)
  })

  it('customers never read billing, plan_step, notify fields or the PR link', () => {
    const grant = /grant select \(([^)]*)\)\s+on table public.change_requests to authenticated/.exec(code)
    expect(grant).not.toBeNull()
    const cols = grant![1].split(',').map((c) => c.trim())
    for (const hidden of ['billing', 'plan_step', 'notified_at', 'notify_error', 'pr_url']) expect(cols).not.toContain(hidden)
  })
})
