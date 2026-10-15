import { readdirSync, readFileSync, statSync } from 'node:fs'
import { join, relative } from 'node:path'
import { describe, expect, it } from 'vitest'

/**
 * Buyout price rule (QA, Sep 25, 2026): the price lives only in website_requests.buyout_price_cents,
 * admin-only in the database. Nothing may read (or write) a price from a "Buyout price: $N" notes
 * line, in admin or customer code.
 */
const ROOT = join(__dirname, '..', '..', '..')
const SRC = join(ROOT, 'src')
const MIGRATION = join(
  ROOT,
  'supabase',
  'migrations',
  '20260925204000_website_requests_buyout_price_cents.sql'
)

function sourceFiles(dir: string): string[] {
  return readdirSync(dir).flatMap((name) => {
    const p = join(dir, name)
    if (statSync(p).isDirectory()) return sourceFiles(p)
    return /\.(ts|tsx)$/.test(name) && !/\.test\.(ts|tsx)$/.test(name) ? [p] : []
  })
}

describe('buyout price source: column only, never notes', () => {
  it('no app code parses or writes a "Buyout price: $N" notes line', () => {
    const offenders = sourceFiles(SRC).filter((f) => /Buyout price:\s*\\?\$/.test(readFileSync(f, 'utf8')))
    expect(offenders.map((f) => relative(ROOT, f))).toEqual([])
  })

  it('customer pages never touch the price column', () => {
    const customer = sourceFiles(join(SRC, 'app', '(dashboard)'))
    const offenders = customer.filter((f) => /buyout_price_cents/.test(readFileSync(f, 'utf8')))
    expect(offenders.map((f) => relative(ROOT, f))).toEqual([])
  })

  it('migration: admin-only column + guard trigger, and no backfill from notes', () => {
    const sql = readFileSync(MIGRATION, 'utf8')
    const code = sql
      .split('\n')
      .filter((l) => !l.trim().startsWith('--'))
      .join('\n')
    expect(code).toMatch(/add column if not exists buyout_price_cents integer/)
    expect(code).toMatch(/check \(buyout_price_cents is null or buyout_price_cents >= 0\)/)
    expect(code).toMatch(/before insert or update on public\.website_requests/)
    expect(code).toMatch(/current_user = 'service_role'/)
    expect(code).toMatch(/errcode = '42501'/)
    // No UPDATE ... FROM notes / regex parsing of notes into the column.
    expect(code).not.toMatch(/update public\.website_requests/i)
    expect(code).not.toMatch(/Buyout price/)
  })
})

describe('buyout detection: is_buyout only, never the notes line', () => {
  const IS_BUYOUT_MIGRATION = join(ROOT, 'supabase', 'migrations', '20260925204500_website_requests_is_buyout.sql')

  it('no app code detects a buyout from the "Buyout request (dashboard):" notes line', () => {
    const offenders = sourceFiles(SRC).filter((f) =>
      /includes\(\s*(BUYOUT_NOTE_MARKER|['"`]Buyout request \(dashboard\):)|isBuyoutRequest/.test(readFileSync(f, 'utf8'))
    )
    expect(offenders.map((f) => relative(ROOT, f))).toEqual([])
  })

  it('admin row, admin action and customer pages read is_buyout', () => {
    for (const rel of [
      'src/app/admin/AdminRequestRow.tsx',
      'src/app/admin/actions.ts',
      'src/app/admin/requests/page.tsx',
      'src/app/(dashboard)/dashboard/page.tsx',
      'src/app/(dashboard)/dashboard/cancel/page.tsx',
      'src/lib/buyout/supabase-store.ts',
    ]) {
      expect(readFileSync(join(ROOT, rel), 'utf8'), rel).toMatch(/is_buyout/)
    }
  })

  it('migration: column, guard trigger, one-time backfill, price requires is_buyout', () => {
    const code = readFileSync(IS_BUYOUT_MIGRATION, 'utf8')
      .split('\n')
      .filter((l) => !l.trim().startsWith('--'))
      .join('\n')
    expect(code).toMatch(/add column if not exists is_buyout boolean not null default false/)
    expect(code).toMatch(/before insert or update on public\.website_requests/)
    expect(code).toMatch(/current_user = 'service_role'/)
    expect(code).toMatch(/errcode = '42501'/)
    expect(code).toMatch(/set is_buyout = true\s+where is_buyout = false\s+and notes like '%Buyout request \(dashboard\):%'/)
    expect(code).toMatch(/check \(buyout_price_cents is null or is_buyout\)/)
  })
})
