// @vitest-environment node
import { readFileSync } from 'node:fs'
import path from 'node:path'
import { describe, expect, it } from 'vitest'

/**
 * Static checks on the email_sends migration (round 6), so CI catches a regression without a database.
 * The behaviour itself (double apply, grants, claim rules, concurrency) was run on a throwaway Postgres 17:
 * /workspace/owen/email-sends-pgtest/run-throwaway.sh.
 */
const sql = readFileSync(
  path.resolve(__dirname, '../../../supabase/migrations/20261003160000_email_sends.sql'),
  'utf8'
).toLowerCase()
const code = sql.replace(/--.*$/gm, '')

describe('20261003160000_email_sends.sql', () => {
  it('is idempotent DDL', () => {
    expect(code).toContain('create table if not exists public.email_sends')
    expect(code).toContain('create index if not exists email_sends_created_at_idx on public.email_sends (created_at)')
    expect(code).not.toMatch(/create (table|index) (?!if not exists)/)
    expect(code.match(/create policy/g)?.length).toBe(code.match(/if not exists \(\s*select 1 from pg_policies/g)?.length)
    expect(code).not.toMatch(/create function/) // only create or replace
  })

  it('has the agreed columns, the unique key, and no personal-data columns', () => {
    for (const col of ['id uuid primary key default gen_random_uuid()', 'stripe_event_id text not null', 'template text not null',
      "status text not null default 'pending' check (status in ('pending', 'sent', 'failed'))", 'resend_id text null',
      'attempts integer not null default 1', 'last_error text null', 'created_at timestamptz not null default now()',
      'updated_at timestamptz not null default now()', 'unique (stripe_event_id, template)']) {
      expect(code).toContain(col)
    }
    expect(code).not.toMatch(/\b(email|recipient|to_address|customer|name|address)\b\s+text/)
  })

  it('locks the table down: RLS forced, nothing for anon / authenticated, no DELETE for service_role', () => {
    expect(code).toContain('alter table public.email_sends enable row level security')
    expect(code).toContain('alter table public.email_sends force row level security')
    expect(code).toContain('revoke all on table public.email_sends from public, anon, authenticated, service_role')
    expect(code).toContain('grant select, insert, update on table public.email_sends to service_role')
    expect(code).not.toMatch(/grant [^;]* to [^;]*\b(anon|authenticated|public)\b/)
    expect(code).not.toMatch(/create policy [^;]* to [^;]*\b(anon|authenticated|public)\b/)
  })

  it('every function pins search_path = \'\' and is executable by service_role only; only the prune is SECURITY DEFINER', () => {
    const fns = [...code.matchAll(/create or replace function public\.(\w+)\(([^)]*)\)/g)].map((m) => m[1])
    expect(fns.sort()).toEqual(['email_send_claim', 'email_send_finish', 'prune_email_sends'])
    expect(code.match(/set search_path = ''/g)?.length).toBe(3)
    expect(code.match(/security definer/g)?.length).toBe(1)
    expect(code).toMatch(/function public\.prune_email_sends\(\)\s*returns integer\s*language plpgsql\s*security definer/)
    for (const f of fns) {
      expect(code).toMatch(new RegExp(`revoke execute on function public\\.${f}\\([^)]*\\) from public, anon, authenticated;`))
      expect(code).toMatch(new RegExp(`grant execute on function public\\.${f}\\([^)]*\\) to service_role;`))
    }
    expect(code).toContain("created_at < pg_catalog.now() - interval '30 days'")
    expect(code).not.toContain('cron.')
  })

  it('claims with ON CONFLICT DO NOTHING, then one conditional re-claim UPDATE that bumps attempts', () => {
    expect(code).toContain('on conflict (stripe_event_id, template) do nothing')
    expect(code).toMatch(/attempts = e\.attempts \+ 1/)
    expect(code).toMatch(/e\.status = 'failed'\s*or \(e\.status = 'pending' and e\.updated_at < pg_catalog\.now\(\) - interval '15 minutes'\)/)
  })
})
