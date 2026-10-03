// @vitest-environment node
/**
 * Guard (billing_ledger description fix, Oct 3): every app query that selects columns from
 * billing_ledger may only name columns that supabase/migrations actually define. Selecting a
 * column that no migration creates (e.g. `description`) fails the whole PostgREST query with 42703.
 */
import { readFileSync, readdirSync, statSync } from 'node:fs'
import path from 'node:path'
import { describe, expect, it } from 'vitest'

const ROOT = path.resolve(__dirname, '../../..')
const MIGRATIONS = path.join(ROOT, 'supabase/migrations')
const SRC = path.join(ROOT, 'src')
const TABLE = 'billing_ledger'

const NON_COLUMN = new Set(['constraint', 'primary', 'unique', 'check', 'foreign', 'exclude', 'like'])
const tableRef = `(?:public\\.)?"?${TABLE}"?`

/** Columns of billing_ledger after applying every migration in filename order. */
function migrationColumns(sqlFiles: string[]): Set<string> {
  const cols = new Set<string>()
  for (const raw of sqlFiles) {
    const sql = raw.replace(/--[^\n]*/g, '')
    const create = new RegExp(`create\\s+table\\s+(?:if\\s+not\\s+exists\\s+)?${tableRef}\\s*\\(([\\s\\S]*?)\\)\\s*;`, 'gi')
    for (const m of sql.matchAll(create)) {
      // Split the body on top-level commas only.
      let depth = 0
      let cur = ''
      const parts: string[] = []
      for (const ch of m[1]) {
        if (ch === '(') depth++
        if (ch === ')') depth--
        if (ch === ',' && depth === 0) {
          parts.push(cur)
          cur = ''
        } else cur += ch
      }
      parts.push(cur)
      for (const part of parts) {
        const name = part.trim().split(/\s+/)[0]?.replace(/"/g, '').toLowerCase()
        if (name && !NON_COLUMN.has(name)) cols.add(name)
      }
    }
    const alter = new RegExp(`alter\\s+table\\s+(?:if\\s+exists\\s+)?(?:only\\s+)?${tableRef}\\s+([\\s\\S]*?);`, 'gi')
    for (const m of sql.matchAll(alter)) {
      for (const a of m[1].matchAll(/add\s+column\s+(?:if\s+not\s+exists\s+)?"?(\w+)"?/gi)) cols.add(a[1].toLowerCase())
      for (const d of m[1].matchAll(/drop\s+column\s+(?:if\s+exists\s+)?"?(\w+)"?/gi)) cols.delete(d[1].toLowerCase())
      for (const r of m[1].matchAll(/rename\s+column\s+"?(\w+)"?\s+to\s+"?(\w+)"?/gi)) {
        cols.delete(r[1].toLowerCase())
        cols.add(r[2].toLowerCase())
      }
    }
  }
  return cols
}

/** Column names named by a PostgREST select string (ignores `*`, embedded relations, aliases, casts). */
function selectColumns(select: string): string[] {
  let depth = 0
  let flat = ''
  for (const ch of select) {
    if (ch === '(') {
      // Embedded resource like `profiles(email)`: mark its name so it is not read as a column.
      if (depth === 0) flat += '#embedded'
      depth++
    } else if (ch === ')') depth--
    else if (depth === 0) flat += ch
  }
  return flat
    .split(',')
    .map((c) => c.trim())
    .filter((c) => c && c !== '*')
    .map((c) => (c.includes(':') && !c.includes('::') ? c.split(':').pop()! : c))
    .map((c) => c.split('::')[0].split('->')[0].trim())
    .filter((c) => /^\w+$/.test(c))
    .filter((c, i, all) => all.indexOf(c) === i)
}

function walk(dir: string): string[] {
  return readdirSync(dir).flatMap((f) => {
    const full = path.join(dir, f)
    if (statSync(full).isDirectory()) return walk(full)
    return /\.(ts|tsx)$/.test(f) && !/\.test\.tsx?$/.test(f) ? [full] : []
  })
}

/** Every `.from('billing_ledger') ... .select(x)` in app source, with x resolved to a string. */
function appSelects(): { file: string; select: string | null; raw: string }[] {
  const files = walk(SRC)
  const sources = new Map(files.map((f) => [f, readFileSync(f, 'utf8')]))
  const consts = new Map<string, string>()
  for (const src of sources.values()) {
    for (const m of src.matchAll(/export\s+const\s+(\w+)\s*=\s*(['"`])([^'"`]*)\2/g)) consts.set(m[1], m[3])
  }
  const out: { file: string; select: string | null; raw: string }[] = []
  const re = new RegExp(`\\.from\\(\\s*['"\`]${TABLE}['"\`]\\s*\\)((?:(?!\\.from\\()[\\s\\S])*?)\\.select\\(\\s*((['"\`])[^'"\`]*\\3|\\w+)`, 'g')
  for (const [file, src] of sources) {
    for (const m of src.matchAll(re)) {
      const arg = m[2].trim()
      const lit = arg.match(/^(['"`])([^'"`]*)\1$/)
      const select = lit ? lit[2] : (consts.get(arg) ?? null)
      out.push({ file: path.relative(ROOT, file), select, raw: arg })
    }
  }
  return out
}

describe('billing_ledger columns selected by the app exist in the migrations', () => {
  const sql = readdirSync(MIGRATIONS)
    .filter((f) => f.endsWith('.sql'))
    .sort()
    .map((f) => readFileSync(path.join(MIGRATIONS, f), 'utf8'))
  const defined = migrationColumns(sql)

  it('parses the billing_ledger columns from the migrations', () => {
    expect([...defined].sort()).toEqual(['amount_cents', 'created_at', 'id', 'profile_id', 'stripe_invoice_id', 'tip_cents'])
  })

  it('finds the app selects (guard is not vacuous) and each resolves to a string', () => {
    const selects = appSelects()
    expect(selects.length).toBeGreaterThanOrEqual(2)
    for (const s of selects) expect(s.select, `${s.file}: unresolved select(${s.raw})`).not.toBeNull()
  })

  it('every selected billing_ledger column is defined by a migration', () => {
    const missing = appSelects().flatMap((s) =>
      selectColumns(s.select ?? '')
        .filter((c) => !defined.has(c.toLowerCase()))
        .map((c) => `${s.file}: billing_ledger.${c}`)
    )
    expect(missing).toEqual([])
  })

  it('self-check: the old description select would be caught', () => {
    expect(selectColumns('created_at, amount_cents, description').filter((c) => !defined.has(c))).toEqual(['description'])
    expect(selectColumns('id, paid:amount_cents, profiles(email), created_at::text')).toEqual(['id', 'amount_cents', 'created_at'])
  })

  it('self-check: alter table add/drop/rename column is tracked', () => {
    const cols = migrationColumns([
      'create table public.billing_ledger (id uuid primary key, amount_cents integer not null, constraint x unique (id));',
      'alter table public.billing_ledger add column if not exists note text;',
      'alter table public.billing_ledger rename column note to memo;',
      'alter table if exists public.billing_ledger drop column amount_cents;',
    ])
    expect([...cols].sort()).toEqual(['id', 'memo'])
  })
})
