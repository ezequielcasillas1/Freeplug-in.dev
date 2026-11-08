import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'
import { PLAN_STEP_IDS } from './ladder'

const sql = readFileSync(join(__dirname, '..', '..', '..', 'supabase', 'migrations', '20261109130000_plug_authority_plan_step.sql'), 'utf8')

describe('20261109130000_plug_authority_plan_step.sql', () => {
  it('every plan_step CHECK matches ladder.ts', () => {
    const lists = [...sql.matchAll(/plan_step in \(([^)]*)\)/g)].map((m) => m[1].split(',').map((s) => s.trim().replace(/'/g, '')))
    expect(lists.length).toBeGreaterThanOrEqual(3)
    for (const l of lists) expect(l).toEqual([...PLAN_STEP_IDS])
  })
})
