// @vitest-environment node
import { readdirSync, readFileSync, statSync } from 'node:fs'
import path from 'node:path'
import { beforeAll, describe, expect, it } from 'vitest'
import type { PGlite } from '@electric-sql/pglite'
import { asRole, migratedDb } from '../../../test/supabase-pglite'
import { supabaseBuyoutStore } from '@/lib/buyout/supabase-store'
import type { SupabaseClient } from '@supabase/supabase-js'
import { isOpenRequestStatus, isSelfClosableStatus, OPEN_REQUEST_STATUSES, SELF_CLOSABLE_STATUSES, PRE_AGREEMENT_STATUSES, WEBSITE_REQUEST_STATUSES } from './status'

/**
 * Aria's ruling (Oct 22 r2): "open" = any status other than closed, everywhere, from ONE definition
 * per language. These tests fail if the TS constants and the SQL definitions drift, or if a
 * hard-coded status list creeps back into TS code, SQL functions, policies or the unique index.
 */
describe('open request status: TS and SQL stay in sync', () => {
  let db: PGlite
  beforeAll(async () => {
    db = await migratedDb()
  }, 60_000)

  it('TS: open is every status except closed', () => {
    expect([...OPEN_REQUEST_STATUSES]).toEqual(WEBSITE_REQUEST_STATUSES.filter((s) => s !== 'closed'))
    for (const s of WEBSITE_REQUEST_STATUSES) expect(isOpenRequestStatus(s)).toBe(s !== 'closed')
    expect(isOpenRequestStatus(null)).toBe(false)
  })

  it('SQL status check allows exactly the TS statuses', async () => {
    const r = await db.query<{ def: string }>(
      `select pg_get_constraintdef(oid) as def from pg_constraint where conname = 'website_requests_status_check'`
    )
    const values = [...r.rows[0].def.matchAll(/'([a-z_]+)'/g)].map((m) => m[1])
    expect(values.sort()).toEqual([...WEBSITE_REQUEST_STATUSES].sort())
  })

  it('public.website_request_is_open / _is_pre_agreement agree with the TS constants for every status', async () => {
    for (const s of WEBSITE_REQUEST_STATUSES) {
      const r = await db.query<{ open: boolean; pre: boolean }>(
        `select public.website_request_is_open($1) as open, public.website_request_is_pre_agreement($1) as pre`,
        [s]
      )
      expect(r.rows[0].open, s).toBe((OPEN_REQUEST_STATUSES as readonly string[]).includes(s))
      expect(r.rows[0].pre, s).toBe((PRE_AGREEMENT_STATUSES as readonly string[]).includes(s))
    }
    expect((await db.query<{ v: boolean }>(`select public.website_request_is_open(null) as v`)).rows[0].v).toBe(false)
  })

  it.each(['submitted', 'in_review', 'consultation', 'agreed'])('close RPCs close an open %s request; the unique index counts it as open', async (status) => {
    const u = crypto.randomUUID()
    await db.exec(`insert into auth.users(id, email) values ('${u}', '${u}@x.test'); insert into public.profiles(id) values ('${u}') on conflict do nothing;`)
    const r = await asRole(db, 'service_role', null, `insert into website_requests(user_id, business_name, status) values ('${u}', 'Biz', 'submitted') returning id`)
    const id = String(r.rows[0].id)
    if (status === 'agreed') {
      await asRole(db, 'service_role', null, `insert into consultations(request_id, user_id, path, ready_for_review_at, agreed_at) values ('${id}', '${u}', 'form', now(), now())`)
    }
    expect((await asRole(db, 'service_role', null, `update website_requests set status = '${status}' where id = '${id}'`)).ok).toBe(true)
    expect((await asRole(db, 'service_role', null, `insert into website_requests(user_id, business_name) values ('${u}', 'Second')`)).ok).toBe(false)
    expect((await asRole(db, 'service_role', null, `select cancel_website_request_for_user('${u}')`)).ok).toBe(true)
    expect((await db.query<{ status: string }>(`select status from website_requests where id = '${id}'`)).rows[0].status).toBe('closed')
    // cancel_own_website_request (auth.uid()) uses the same definition.
    const r2 = await asRole(db, 'service_role', null, `insert into website_requests(user_id, business_name) values ('${u}', 'Again') returning id`)
    await asRole(db, 'service_role', null, `update website_requests set status = 'consultation' where id = '${r2.rows[0].id}'`)
    await db.exec(`select set_config('request.jwt.claim.sub', '${u}', false)`)
    expect((await db.query(`select public.cancel_own_website_request()`)).rows).toHaveLength(1)
    expect((await db.query<{ status: string }>(`select status from website_requests where id = '${r2.rows[0].id}'`)).rows[0].status).toBe('closed')
  })

  it('self-closable: TS SELF_CLOSABLE_STATUSES = open minus building = public.website_request_is_self_closable', async () => {
    expect([...SELF_CLOSABLE_STATUSES]).toEqual(OPEN_REQUEST_STATUSES.filter((s) => s !== 'building'))
    for (const s of WEBSITE_REQUEST_STATUSES) {
      const r = await db.query<{ v: boolean }>(`select public.website_request_is_self_closable($1) as v`, [s])
      expect(r.rows[0].v, s).toBe(isSelfClosableStatus(s))
    }
    expect((await db.query<{ v: boolean }>(`select public.website_request_is_self_closable(null) as v`)).rows[0].v).toBe(false)
  })

  it('close RPCs refuse a building request (hint building) and leave it building; the index still counts it as open', async () => {
    const u = crypto.randomUUID()
    await db.exec(`insert into auth.users(id, email) values ('${u}', '${u}@x.test'); insert into public.profiles(id) values ('${u}') on conflict do nothing;`)
    const r = await asRole(db, 'service_role', null, `insert into website_requests(user_id, business_name, status) values ('${u}', 'Biz', 'submitted') returning id`)
    const id = String(r.rows[0].id)
    await asRole(db, 'service_role', null, `insert into consultations(request_id, user_id, path, ready_for_review_at, agreed_at) values ('${id}', '${u}', 'form', now(), now())`)
    expect((await asRole(db, 'service_role', null, `update website_requests set status = 'building' where id = '${id}'`)).ok).toBe(true)
    expect((await asRole(db, 'service_role', null, `insert into website_requests(user_id, business_name) values ('${u}', 'Second')`)).ok).toBe(false)
    await expect(db.query(`select public.cancel_website_request_for_user('${u}')`)).rejects.toMatchObject({
      message: expect.stringMatching(/being built/),
      hint: 'building',
    })
    await db.exec(`select set_config('request.jwt.claim.sub', '${u}', false)`)
    await expect(db.query(`select public.cancel_own_website_request()`)).rejects.toMatchObject({ hint: 'building' })
    expect((await db.query<{ status: string }>(`select status from website_requests where id = '${id}'`)).rows[0].status).toBe('building')
  })

  it('customers still cannot call the close RPCs directly', async () => {
    const u = crypto.randomUUID()
    expect((await asRole(db, 'authenticated', u, `select public.cancel_website_request_for_user('${u}')`)).ok).toBe(false)
    expect((await asRole(db, 'authenticated', u, `select public.cancel_own_website_request()`)).ok).toBe(false)
  })

  it('buyout store reads and updates the open request with the shared TS list', async () => {
    const calls: unknown[][] = []
    const chain: Record<string, unknown> = {}
    for (const m of ['select', 'eq', 'update']) chain[m] = (...a: unknown[]) => (calls.push([m, ...a]), chain)
    chain.in = (...a: unknown[]) => (calls.push(['in', ...a]), chain)
    chain.maybeSingle = async () => ({ data: null, error: null })
    const store = supabaseBuyoutStore({ from: () => chain } as unknown as SupabaseClient)
    await store.getOpenRequest('u1')
    expect(calls.find((c) => c[0] === 'in')).toEqual(['in', 'status', [...OPEN_REQUEST_STATUSES]])
  })

  it('the one-open-per-user unique index uses the shared definition', async () => {
    const r = await db.query<{ def: string }>(`select indexdef as def from pg_indexes where indexname = 'website_requests_one_open_per_user'`)
    expect(r.rows[0].def).toMatch(/UNIQUE/)
    expect(r.rows[0].def).toMatch(/website_request_is_open\(status\)/)
  })

  it('no SQL function or policy hard-codes an open-status list (latest definitions)', async () => {
    const fns = await db.query<{ name: string; src: string }>(
      `select p.proname as name, p.prosrc as src from pg_proc p join pg_namespace n on n.oid = p.pronamespace
       where n.nspname = 'public' and p.prosrc ~ $1`,
      [`'in_review'`]
    )
    const allowed = new Set(['website_request_is_pre_agreement'])
    expect(fns.rows.map((f) => f.name).filter((n) => !allowed.has(n))).toEqual([])
    const pols = await db.query<{ name: string }>(
      `select policyname as name from pg_policies where schemaname = 'public'
       and (coalesce(qual, '') ~ $1 or coalesce(with_check, '') ~ $1)`,
      [`'in_review'`]
    )
    expect(pols.rows).toEqual([])
  })

  it('no TS source outside lib/consultation/status.ts hard-codes an open-status list', () => {
    const root = path.resolve(__dirname, '../..')
    const offenders: string[] = []
    const walk = (dir: string) => {
      for (const f of readdirSync(dir)) {
        const p = path.join(dir, f)
        if (statSync(p).isDirectory()) walk(p)
        else if (/\.(ts|tsx)$/.test(f) && !/\.test\./.test(f) && !p.endsWith(path.join('consultation', 'status.ts'))) {
          const s = readFileSync(p, 'utf8')
          if (/\[\s*'submitted',\s*'in_review'/.test(s) || /=== 'submitted' \|\| \w+(\?\.|\.)status === 'in_review'/.test(s)) offenders.push(path.relative(root, p))
        }
      }
    }
    walk(root)
    expect(offenders).toEqual([])
  })
})
