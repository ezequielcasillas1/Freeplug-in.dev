// @vitest-environment node
import { readFileSync } from 'node:fs'
import path from 'node:path'
import { describe, expect, it } from 'vitest'
import { CHANGE_TYPES } from '@/lib/help/help-chat-content'

const root = path.resolve(__dirname, '../../..')
const migration = readFileSync(path.join(root, 'supabase/migrations/20261013091000_low_check_constraints.sql'), 'utf8')
const counts = readFileSync(path.join(root, 'supabase/checks/count-bad-rows-20261013091000.sql'), 'utf8')
const code = (sql: string) => sql.replace(/--.*$/gm, '')
const sqlList = (sql: string) => [...sql.matchAll(/'([^']+)'/g)].map((m) => m[1])

describe('Lows migration: change_requests checks (phase 5 L-1 / L-2)', () => {
  it("description uses Vera's btrim form (spaces, tabs, newlines, CRs), NOT VALID", () => {
    expect(migration).toContain("check (btrim(description, E' \\t\\n\\r') <> '') not valid;")
    expect(counts).toContain("not (btrim(description, E' \\t\\n\\r') <> '')")
  })
  it('change_type is limited to exactly CHANGE_TYPES, NOT VALID, and counted in the read-only query', () => {
    const check = migration.match(/check \(change_type in \(([^)]*)\)\) not valid;/)
    expect(check).not.toBeNull()
    expect(sqlList(check![1])).toEqual([...CHANGE_TYPES])
    const count = counts.match(/change_type not in \(([^)]*)\)/)
    expect(sqlList(count![1])).toEqual([...CHANGE_TYPES])
    expect(counts).toContain('change_requests_change_type_allowed_check')
  })
  it('(a) was dropped: the existing addon_removals_owed_cleared_check already covers a blank cleared_how', () => {
    expect(code(migration)).not.toMatch(/addon_removals_owed/)
    expect(code(counts)).not.toMatch(/addon_removals_owed/)
    const owed = readFileSync(path.join(root, 'supabase/migrations/20261004092000_addon_removals_owed.sql'), 'utf8')
    expect(owed).toMatch(/cleared_at is not null and cleared_how in \('refunded', 'not_billed', 'kept'\)/)
  })
  it('nothing is validated in this migration; the count query is read-only', () => {
    expect(code(migration)).not.toMatch(/validate constraint/i)
    expect(counts).toMatch(/begin transaction read only;/)
    expect(code(counts)).not.toMatch(/\b(insert|update|delete|alter|drop)\b/i)
  })
})
