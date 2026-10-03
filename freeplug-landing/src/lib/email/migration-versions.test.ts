// @vitest-environment node
import { readdirSync } from 'node:fs'
import path from 'node:path'
import { describe, expect, it } from 'vitest'

/**
 * Migration version check (Aria, Oct 3). Standalone static check, kept in its own commit so it can
 * move to the Cloudflare port branch. Supabase keys schema_migrations by the 14-digit version in
 * the filename, so two files with one version (or a file sorted before an already-used version)
 * break `supabase db push` / migration history. Every file in supabase/migrations must:
 *   - be named <14-digit version>_<snake_case name>.sql
 *   - have a version strictly greater than the file before it (unique, strictly increasing).
 *
 * GRANDFATHERED (decision pending, Aria/Ezequiel): the two 20260403120000 files below were added
 * before this check and may already be recorded in hosted migration history, so renaming them is
 * not something to do from a branch. They are the only exception; any new duplicate fails.
 */
const DIR = path.resolve(__dirname, '../../../supabase/migrations')
const GRANDFATHERED_DUPLICATES: ReadonlyArray<readonly [string, string]> = [
  ['20260403120000_billing_ledger_select_own.sql', '20260403120000_website_transfer_handoff.sql'],
]

export function versionProblems(files: readonly string[]): string[] {
  const problems: string[] = []
  const sorted = [...files].sort()
  let prev: { version: string; file: string } | null = null
  for (const file of sorted) {
    const m = /^(\d{14})_[a-z0-9_]+\.sql$/.exec(file)
    if (!m) {
      problems.push(`bad filename: ${file}`)
      continue
    }
    const version = m[1]
    if (prev && version <= prev.version) {
      const allowed = GRANDFATHERED_DUPLICATES.some(([a, b]) => a === prev!.file && b === file)
      if (!allowed) problems.push(`version ${version} (${file}) is not greater than ${prev.version} (${prev.file})`)
    }
    prev = { version, file }
  }
  return problems
}

describe('supabase/migrations versions', () => {
  const files = readdirSync(DIR).filter((f) => !f.startsWith('.'))

  it('has unique versions in strictly increasing order', () => {
    expect(files.length).toBeGreaterThan(0)
    expect(versionProblems(files)).toEqual([])
  })

  it('the grandfathered pair is still exactly that pair (no third file at that version)', () => {
    for (const [a, b] of GRANDFATHERED_DUPLICATES) {
      const v = a.slice(0, 14)
      expect(files.filter((f) => f.startsWith(`${v}_`)).sort()).toEqual([a, b])
    }
  })

  it('catches duplicates, out-of-order and malformed names', () => {
    expect(versionProblems(['20260101000000_a.sql', '20260101000000_b.sql'])).toHaveLength(1)
    expect(versionProblems(['20260101000000_a.sql', '20260102000000_b.sql'])).toEqual([])
    expect(versionProblems(['2026010100000_short.sql'])).toEqual(['bad filename: 2026010100000_short.sql'])
    expect(versionProblems(['20260101000000_Upper.sql'])).toHaveLength(1)
    expect(versionProblems(['20260101000000_a.sql', '20260101000000_a.sql.bak'])).toHaveLength(1)
  })
})
