// @vitest-environment node
import { readFileSync, readdirSync, statSync } from 'node:fs'
import path from 'node:path'
import { describe, expect, it } from 'vitest'

// Aria, Oct 13: website_requests grants. anon gets nothing; authenticated keeps only SELECT, INSERT, UPDATE
// (the request form writes with the user's session, under RLS). Pins the migration and the evidence.
const root = path.resolve(__dirname, '../../..')
const mig = readFileSync(path.join(root, 'supabase/migrations/20261013094000_website_requests_grants.sql'), 'utf8')
const code = (s: string) => s.replace(/--.*$/gm, '').trim()

describe('website_requests grants migration', () => {
  it('revokes everything from anon and DELETE/TRUNCATE/REFERENCES/TRIGGER from authenticated, nothing else', () => {
    expect(code(mig).split(/;\s*/).filter(Boolean)).toEqual([
      'revoke all on table public.website_requests from anon',
      'revoke delete, truncate, references, trigger on table public.website_requests from authenticated',
    ])
  })
  it('sorts after 20261003220000 and the other new migrations; r13 copy untouched', () => {
    const files = readdirSync(path.join(root, 'supabase/migrations')).sort()
    // Oct 18: 20261018090000_edits_quotes_ownership.sql now sorts after it.
    expect(files.indexOf('20261013094000_website_requests_grants.sql')).toBe(files.indexOf('20261018090000_edits_quotes_ownership.sql') - 1)
    expect(files).toContain('20261003220000_revoke_client_writes.sql')
  })
  it('INSERT and UPDATE are still needed: the request form writes website_requests with the user session client', () => {
    const src = readFileSync(path.join(root, 'src/app/(dashboard)/dashboard/request-website/actions.ts'), 'utf8')
    const save = src.slice(src.indexOf('async function saveWebsiteRequest('), src.indexOf('async function saveWebsiteRequest(') + 4000)
    expect(save).toMatch(/supabase: ServerSupabase/)
    expect(save).toMatch(/await supabase\s*\.from\('website_requests'\)\s*\.update\(/)
    expect(save).toMatch(/await supabase\s*\.from\('website_requests'\)\s*\.insert\(/)
  })
  it('no app code deletes website_requests rows', () => {
    const files: string[] = []
    const walk = (d: string) => {
      for (const n of readdirSync(d)) {
        const p = path.join(d, n)
        if (statSync(p).isDirectory()) walk(p)
        else if (/\.(ts|tsx)$/.test(n) && !/\.test\.tsx?$/.test(n)) files.push(p)
      }
    }
    walk(path.join(root, 'src'))
    const deleters = files.filter((f) => /from\('website_requests'\)\s*\.delete\(/.test(readFileSync(f, 'utf8')))
    expect(deleters).toEqual([])
  })
})
