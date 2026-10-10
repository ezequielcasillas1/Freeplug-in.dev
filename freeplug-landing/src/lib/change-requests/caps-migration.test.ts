import { readFileSync, readdirSync } from 'node:fs'
import path from 'node:path'
import { describe, expect, it } from 'vitest'

const DIR = path.resolve(__dirname, '../../../supabase/migrations')
const FILE = '20261010160000_change_request_caps.sql'
const sql = readFileSync(path.join(DIR, FILE), 'utf8').toLowerCase()

describe(`${FILE} (ruling 8; live checks in change-req-pgtest)`, () => {
  it('sorts after the change_requests table migration', () => {
    const all = readdirSync(DIR).filter((f) => f.endsWith('.sql')).sort()
    expect(all.indexOf(FILE)).toBeGreaterThan(all.indexOf('20261004150000_change_requests.sql'))
  })
  it('BEFORE INSERT trigger: 10 pending, 20 per rolling 24h, serialised per user', () => {
    expect(sql).toContain('before insert on public.change_requests')
    expect(sql).toMatch(/status = 'pending_review';\s+if pending_count >= 10/)
    expect(sql).toMatch(/created_at > now\(\) - interval '24 hours';\s+if day_count >= 20/)
    expect(sql).toContain("raise exception 'change_requests_pending_cap'")
    expect(sql).toContain("raise exception 'change_requests_daily_cap'")
    expect(sql).toContain('pg_advisory_xact_lock')
    expect(sql).toContain('security definer')
    expect(sql).toContain('set search_path')
  })
  it('description length matches the form (raw 1-2000, not only spaces) and is never trimmed on store', () => {
    expect(sql).toContain('check (char_length(description) between 1 and 2000 and char_length(btrim(description)) >= 1)')
    expect(sql).not.toMatch(/new\.description\s*:?=/)
  })
  it('idempotent', () => {
    expect(sql).toContain('drop trigger if exists')
    expect(sql).toContain('create or replace function')
    expect(sql).toContain('drop constraint if exists change_requests_description_check')
  })
})
