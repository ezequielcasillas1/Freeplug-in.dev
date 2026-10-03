// @vitest-environment node
import { createHash } from 'node:crypto'
import { readdirSync, readFileSync } from 'node:fs'
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
 * ONE pinned exception (Aria, Oct 3 12:25): the two 20260403120000 files below predate this check
 * and may already be recorded in hosted migration history, so they are NOT renamed. They are
 * pinned by version, exact filename AND sha256 of the file bytes: any other duplicate, a third
 * file at that version, a rename, or any edit to either file fails the check.
 */
const DIR = path.resolve(__dirname, '../../../supabase/migrations')

export type PinnedDuplicate = { version: string; files: readonly { name: string; sha256: string }[] }

export const PINNED_DUPLICATES: readonly PinnedDuplicate[] = [
  {
    version: '20260403120000',
    files: [
      { name: '20260403120000_billing_ledger_select_own.sql', sha256: 'cbc63e16e60bc5051152414ff44781460e2a838781cdcca9376c4f4b4bf8145f' },
      { name: '20260403120000_website_transfer_handoff.sql', sha256: 'f6e6d2e1f84b1d1c6b82bb1a74489f441f154e63e239f1604c9eb85f643c3f42' },
    ],
  },
]

const sha256 = (buf: Buffer | string) => createHash('sha256').update(buf).digest('hex')

/**
 * Problems with a set of migration files. `hashOf(name)` returns the sha256 of a file's bytes; a
 * same-version pair passes only if it matches a PINNED_DUPLICATES entry exactly (version, both
 * names, both hashes, and no other file at that version).
 */
export function versionProblems(
  files: readonly string[],
  hashOf: (file: string) => string,
  pinned: readonly PinnedDuplicate[] = PINNED_DUPLICATES
): string[] {
  const problems: string[] = []
  const byVersion = new Map<string, string[]>()
  for (const file of files) {
    const m = /^(\d{14})_[a-z0-9_]+\.sql$/.exec(file)
    if (!m) {
      problems.push(`bad filename: ${file}`)
      continue
    }
    byVersion.set(m[1], [...(byVersion.get(m[1]) ?? []), file])
  }
  const versions = [...byVersion.keys()].sort()
  for (const version of versions) {
    const group = byVersion.get(version)!.sort()
    if (group.length === 1) continue
    const pin = pinned.find((p) => p.version === version)
    if (!pin) {
      problems.push(`duplicate version ${version}: ${group.join(', ')}`)
      continue
    }
    const want = pin.files.map((f) => f.name).sort()
    if (JSON.stringify(group) !== JSON.stringify(want)) {
      problems.push(`pinned version ${version} must be exactly ${want.join(' + ')}; found ${group.join(', ')}`)
      continue
    }
    for (const f of pin.files) {
      const got = hashOf(f.name)
      if (got !== f.sha256) problems.push(`pinned file ${f.name} changed (sha256 ${got}, pinned ${f.sha256})`)
    }
  }
  // Pins whose files are gone or renamed also fail (a rename would re-run under a new version).
  for (const pin of pinned) {
    for (const f of pin.files) if (!files.includes(f.name)) problems.push(`pinned file missing: ${f.name}`)
  }
  return problems
}

describe('supabase/migrations versions', () => {
  const files = readdirSync(DIR).filter((f) => !f.startsWith('.'))
  const hashOf = (f: string) => sha256(readFileSync(path.join(DIR, f)))

  it('has unique versions in strictly increasing order (one pinned, hashed exception)', () => {
    expect(files.length).toBeGreaterThan(0)
    expect(versionProblems(files, hashOf)).toEqual([])
  })

  it('pins exactly one duplicate pair', () => {
    expect(PINNED_DUPLICATES).toHaveLength(1)
    expect(PINNED_DUPLICATES[0].files).toHaveLength(2)
  })

  describe('catches', () => {
    const pinned = PINNED_DUPLICATES
    const [a, b] = pinned[0].files
    const okHash = (f: string) => pinned[0].files.find((p) => p.name === f)?.sha256 ?? sha256(f)
    const base = ['20260101000000_first.sql', a.name, b.name, '20261003180000_plan_steps.sql']

    it('nothing on the real shape', () => {
      expect(versionProblems(base, okHash)).toEqual([])
    })
    it('any other duplicate version', () => {
      expect(versionProblems([...base, '20261003180000_other.sql'], okHash)).toEqual([
        'duplicate version 20261003180000: 20261003180000_other.sql, 20261003180000_plan_steps.sql',
      ])
    })
    it('a third file at the pinned version', () => {
      expect(versionProblems([...base, '20260403120000_third.sql'], okHash)[0]).toMatch(/^pinned version 20260403120000 must be exactly/)
    })
    it('an edit to either pinned file (hash mismatch)', () => {
      expect(versionProblems(base, (f) => (f === b.name ? 'x'.repeat(64) : okHash(f)))).toEqual([
        `pinned file ${b.name} changed (sha256 ${'x'.repeat(64)}, pinned ${b.sha256})`,
      ])
    })
    it('a rename of a pinned file', () => {
      const renamed = base.map((f) => (f === a.name ? '20260403120001_billing_ledger_select_own.sql' : f))
      const p = versionProblems(renamed, okHash)
      expect(p).toContain(`pinned file missing: ${a.name}`)
    })
    it('malformed names', () => {
      expect(versionProblems(['2026010100000_short.sql'], okHash, [])).toEqual(['bad filename: 2026010100000_short.sql'])
      expect(versionProblems(['20260101000000_Upper.sql'], okHash, [])).toHaveLength(1)
      expect(versionProblems(['20260101000000_a.sql', '20260101000000_a.sql.bak'], okHash, [])).toHaveLength(1)
    })
    it('a duplicate that is not pinned, even with matching content', () => {
      expect(versionProblems(['20260101000000_a.sql', '20260101000000_b.sql'], okHash, [])).toHaveLength(1)
    })
  })
})
