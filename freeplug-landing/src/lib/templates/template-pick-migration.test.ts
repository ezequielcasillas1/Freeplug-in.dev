// @vitest-environment node
import { readFileSync } from 'node:fs'
import path from 'node:path'
import { describe, expect, it } from 'vitest'
import { NICHES } from '@/lib/envato/niche-tags'

/**
 * Static checks on the template-pick migration. Behaviour (every CHECK, the guard trigger, RLS for
 * anon / other user / owner direct UPDATE) runs in one rolled-back transaction on the local Docker
 * Supabase: /workspace/owen/template-pick-pgtest/checks.sql (output in run-output.txt).
 */
const sql = readFileSync(path.resolve(__dirname, '../../../supabase/migrations/20261012180000_website_requests_template_pick.sql'), 'utf8').toLowerCase()
const code = sql.replace(/--.*$/gm, '')

describe('20261012180000_website_requests_template_pick.sql', () => {
  it('adds six nullable columns idempotently', () => {
    for (const c of ['business_type text', 'template_choice text', 'envato_item_id bigint', 'pasted_template_url text', 'template_picked_at timestamptz', 'template_locked_at timestamptz']) {
      expect(code).toContain(`add column if not exists ${c};`)
    }
    expect(code).not.toMatch(/not null default|references/)
  })
  it('business_type CHECK lists exactly the 20 niche keys', () => {
    const m = /business_type in \(([^)]*)\)/.exec(code)!
    const keys = [...m[1].matchAll(/'([a-z_]+)'/g)].map((x) => x[1])
    expect(keys).toEqual([...NICHES])
  })
  it('has the choice, URL and consistency checks', () => {
    expect(code).toContain("template_choice in ('envato_catalog', 'client_pasted', 'team_pick')")
    expect(code).toContain("left(pasted_template_url, 29) = 'https://themeforest.net/item/' and length(pasted_template_url) <= 500")
    expect(code).toContain('website_requests_template_pick_consistency_check')
    expect(code).toContain('else false')
  })
  it('adds no policy, no status values, no license columns, and a server-only guard', () => {
    expect(code).not.toMatch(/create policy|alter policy/)
    expect(code).not.toMatch(/license/)
    expect(code).not.toMatch(/status in/)
    expect(code).toContain("raise exception using")
    expect(code).toContain("errcode = '42501'")
    expect(code).toContain('revoke execute on function public.website_requests_guard_template_pick() from public, anon, authenticated')
  })
})
