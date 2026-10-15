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
 * No pinned exceptions any more (Aria, Oct 13): the old 20260403120000 duplicate was resolved by moving
 * website_transfer_handoff to 20260403120001 (provisional, see the comment in that file). The pin mechanism
 * stays for a future, deliberately pinned case; the "catches" tests use a synthetic pin.
 */
const DIR = path.resolve(__dirname, '../../../supabase/migrations')

export type PinnedDuplicate = { version: string; files: readonly { name: string; sha256: string }[] }

export const PINNED_DUPLICATES: readonly PinnedDuplicate[] = []

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

  it('has unique versions in strictly increasing order (no exceptions)', () => {
    expect(files.length).toBeGreaterThan(0)
    expect(versionProblems(files, hashOf)).toEqual([])
  })

  it('pins nothing; the old 20260403120000 pair is resolved (Aria, Oct 13)', () => {
    expect(PINNED_DUPLICATES).toHaveLength(0)
    expect(files.filter((f) => f.startsWith('20260403120000_'))).toEqual(['20260403120000_billing_ledger_select_own.sql'])
    expect(files).toContain('20260403120001_website_transfer_handoff.sql')
    expect(files).not.toContain('20260403120000_website_transfer_handoff.sql')
    expect(readFileSync(path.join(DIR, '20260403120001_website_transfer_handoff.sql'), 'utf8')).toMatch(/^-- PROVISIONAL VERSION/)
  })

  describe('catches', () => {
    // A synthetic pin (the real list is empty) so the pin mechanism stays tested.
    const pinned: readonly PinnedDuplicate[] = [
      { version: '20260403120000', files: [{ name: '20260403120000_a.sql', sha256: 'a'.repeat(64) }, { name: '20260403120000_b.sql', sha256: 'b'.repeat(64) }] },
    ]
    const [a, b] = pinned[0].files
    const okHash = (f: string) => pinned[0].files.find((p) => p.name === f)?.sha256 ?? sha256(f)
    const base = ['20260101000000_first.sql', a.name, b.name, '20261003180000_plan_steps.sql']

    it('nothing on the real shape', () => {
      expect(versionProblems(base, okHash, pinned)).toEqual([])
    })
    it('any other duplicate version', () => {
      expect(versionProblems([...base, '20261003180000_other.sql'], okHash, pinned)).toEqual([
        'duplicate version 20261003180000: 20261003180000_other.sql, 20261003180000_plan_steps.sql',
      ])
    })
    it('a third file at the pinned version', () => {
      expect(versionProblems([...base, '20260403120000_third.sql'], okHash, pinned)[0]).toMatch(/^pinned version 20260403120000 must be exactly/)
    })
    it('an edit to either pinned file (hash mismatch)', () => {
      expect(versionProblems(base, (f) => (f === b.name ? 'x'.repeat(64) : okHash(f)), pinned)).toEqual([
        `pinned file ${b.name} changed (sha256 ${'x'.repeat(64)}, pinned ${b.sha256})`,
      ])
    })
    it('a rename of a pinned file', () => {
      const renamed = base.map((f) => (f === a.name ? '20260403120001_a.sql' : f))
      const p = versionProblems(renamed, okHash, pinned)
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
