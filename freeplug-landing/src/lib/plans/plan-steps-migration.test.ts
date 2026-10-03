import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'
import { PLAN_STEP_IDS } from './ladder'

// The migration's CHECK lists must match the one config module (src/lib/plans/ladder.ts).
const MIGRATION = join(__dirname, '..', '..', '..', 'supabase', 'migrations', '20261003180000_plan_steps.sql')

describe('20261003180000_plan_steps.sql matches ladder.ts', () => {
  const sql = readFileSync(MIGRATION, 'utf8')
  const lists = [...sql.matchAll(/plan_step in \(([^)]*)\)/g)].map((m) => m[1].split(',').map((s) => s.trim().replace(/'/g, '')))

  it('both CHECK constraints list exactly the six step ids, in order', () => {
    expect(lists).toHaveLength(2)
    for (const l of lists) expect(l).toEqual([...PLAN_STEP_IDS])
  })

  it('every function is revoked from PUBLIC, anon, authenticated and service_role (no default EXECUTE)', () => {
    const fns = [...sql.matchAll(/create or replace function (public\.\w+)\(([^)]*)\)/g)].map((m) => `${m[1]}(${m[2]})`)
    expect(fns.length).toBeGreaterThan(0)
    for (const f of fns) {
      expect(sql).toContain(`revoke all on function ${f} from public, anon, authenticated, service_role;`)
      expect(sql).not.toMatch(new RegExp(`grant execute on function ${f.replace(/[.()]/g, '\\$&')}`))
    }
  })

  it('is idempotent by construction and grants nothing to anon', () => {
    expect(sql).not.toMatch(/^\s*create table (?!if not exists)/im)
    expect(sql).not.toMatch(/^\s*alter table [^;]* add column (?!if not exists)/im)
    expect(sql).not.toMatch(/grant [^;]* to [^;]*\banon\b/i)
    expect(sql).toMatch(/force row level security/)
    expect(sql).toMatch(/unique \(user_id, period_start\)/)
  })
})
