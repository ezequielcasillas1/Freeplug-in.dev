// @vitest-environment node
import { readFileSync } from 'node:fs'
import path from 'node:path'
import { describe, expect, it } from 'vitest'
import { PICK_WINDOW_SERVER_MIN } from './window'

/**
 * Static checks on the pick-window migration. Behaviour (59 / 61 / 64:59 accepted, 65:01 rejected, set-once
 * first pick, unlock 65 min + audit, locked beats unlock, direct client writes blocked) runs in one
 * rolled-back transaction on the local Docker Supabase: /workspace/owen/template-pick-pgtest/window-checks.sql.
 */
const sql = readFileSync(path.resolve(__dirname, '../../../supabase/migrations/20261013200000_template_pick_window.sql'), 'utf8').toLowerCase()
const code = sql.replace(/--.*$/gm, '')

describe('20261013200000_template_pick_window.sql', () => {
  it('adds the two nullable columns idempotently', () => {
    expect(code).toContain('add column if not exists template_first_picked_at timestamptz;')
    expect(code).toContain('add column if not exists template_unlocked_until timestamptz;')
  })
  it('uses the same 65-minute window as window.ts, everywhere', () => {
    const intervals = [...code.matchAll(/interval '(\d+) minutes'/g)].map((m) => Number(m[1]))
    expect(intervals.length).toBeGreaterThanOrEqual(2)
    expect(new Set(intervals)).toEqual(new Set([PICK_WINDOW_SERVER_MIN]))
  })
  it('guard blocks client roles, covers the new columns, set-once first pick, closed window for any role', () => {
    expect(code).toContain("errcode = '42501'")
    expect(code).toContain('new.template_unlocked_until is not distinct from old.template_unlocked_until')
    expect(code).toContain('new.template_first_picked_at is not distinct from old.template_first_picked_at')
    expect(code).toContain('old.template_first_picked_at is not null')
    expect(code).toContain('new.business_type is distinct from old.business_type')
    expect(code).toMatch(/pick_changed and not public\.template_pick_window_open\(\s*old\.status, old\.template_locked_at/)
    expect(code).toContain('p_locked_at is null')
  })
  it('rpc and audit are service role only, audit table forced RLS', () => {
    for (const f of ['template_pick_db_now()', 'template_pick_admin_unlock(uuid, text)', 'website_requests_guard_template_pick()']) {
      expect(code).toContain(`revoke execute on function public.${f} from public, anon, authenticated`)
    }
    expect(code).toContain('grant execute on function public.template_pick_db_now() to service_role')
    expect(code).toContain('alter table public.template_pick_audit force row level security')
    expect(code).toContain('revoke all on table public.template_pick_audit from public, anon, authenticated, service_role')
    expect(code).toContain('grant select, insert on table public.template_pick_audit to service_role')
    expect(code).not.toMatch(/create policy|grant [a-z, ]+ to (anon|authenticated)/)
  })
  it('unlock refuses locked / closed requests and writes the audit row', () => {
    expect(code).toMatch(/set template_unlocked_until = until_at\s+where id = p_request_id\s+and template_locked_at is null/)
    expect(code).toContain("insert into public.template_pick_audit (request_id, action, actor_email, unlocked_until)")
  })
})

const sql2 = readFileSync(path.resolve(__dirname, '../../../supabase/migrations/20261013210000_template_pick_backfill_lock_audit.sql'), 'utf8').toLowerCase()
const code2 = sql2.replace(/--.*$/gm, '')

describe('20261013210000_template_pick_backfill_lock_audit.sql', () => {
  it('backfills first_picked_at from picked_at for existing picks only', () => {
    expect(code2).toMatch(/update public\.website_requests\s+set template_first_picked_at = template_picked_at\s+where template_first_picked_at is null\s+and template_choice is not null\s+and template_picked_at is not null;/)
  })
  it('a pick with NULL first-pick time is closed; same 65 minutes', () => {
    expect(code2).toContain('(p_first_picked_at is null and p_template_choice is null)')
    expect(new Set([...code2.matchAll(/interval '(\d+) minutes'/g)].map((m) => Number(m[1])))).toEqual(new Set([PICK_WINDOW_SERVER_MIN]))
    expect(code2).toMatch(/old\.template_unlocked_until, now\(\),\s+old\.template_choice\)/)
  })
  it('lock is audited atomically and service-role only', () => {
    expect(code2).toContain("check (action in ('unlock', 'lock'))")
    expect(code2).toContain("insert into public.template_pick_audit (request_id, action, actor_email)\n  values (p_request_id, 'lock', p_actor_email)")
    expect(code2).toContain('revoke execute on function public.template_pick_admin_lock(uuid, text) from public, anon, authenticated')
    expect(code2).toContain('grant execute on function public.template_pick_admin_lock(uuid, text) to service_role')
  })
})
