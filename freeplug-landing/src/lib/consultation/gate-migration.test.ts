// @vitest-environment node
import { beforeAll, describe, expect, it } from 'vitest'
import type { PGlite } from '@electric-sql/pglite'
import { asRole, migratedDb } from '../../../test/supabase-pglite'

const A = 'aaaaaaaa-0000-0000-0000-000000000001' // organic request, consultation not agreed
const B = 'aaaaaaaa-0000-0000-0000-000000000002' // existing customer, request closed
const C = 'aaaaaaaa-0000-0000-0000-000000000003' // buyout request
const D = 'aaaaaaaa-0000-0000-0000-000000000004' // outreach claim
const E2 = 'aaaaaaaa-0000-0000-0000-000000000005' // agreed

/** Per-request domain purchase gate (domain_requests_require_agreed_consultation) on real Postgres. */
describe('domain purchase gate (Oct 22 r2)', () => {
  let db: PGlite
  const req: Record<string, string> = {}
  const insertDomain = (uid: string, kind: 'need_domain' | 'have_domain', extra = '') =>
    asRole(db, 'authenticated', uid, `insert into domain_requests(user_id, kind, domain${extra ? ', website_request_id' : ''}) values ('${uid}', '${kind}', ${kind === 'have_domain' ? "'mine.com'" : 'null'}${extra ? `, '${extra}'` : ''}) returning website_request_id`)

  beforeAll(async () => {
    db = await migratedDb()
    for (const u of [A, B, C, D, E2]) await db.exec(`insert into auth.users(id, email) values ('${u}', '${u}@x.test'); insert into public.profiles(id) values ('${u}') on conflict do nothing;`)
    const mk = async (u: string, extra = '') => {
      const r = await asRole(db, 'service_role', null, `insert into website_requests(user_id, business_name, status${extra ? ', ' + extra.split('=')[0] : ''}) values ('${u}', 'Biz', 'submitted'${extra ? ', ' + extra.split('=')[1] : ''}) returning id`)
      expect(r.ok, r.ok ? '' : r.error).toBe(true)
      return String(r.rows[0].id)
    }
    req.A = await mk(A)
    req.B = await mk(B)
    await asRole(db, 'service_role', null, `update website_requests set status = 'closed' where id = '${req.B}'`)
    req.C = await mk(C, "is_buyout=true")
    req.D = await mk(D, "source='outreach'")
    req.E = await mk(E2)
    const c = await asRole(db, 'service_role', null, `insert into consultations(request_id, user_id, path, checklist, ready_for_review_at) values ('${req.E}', '${E2}', 'form', '{}'::jsonb, now()) returning id`)
    expect(c.ok, c.ok ? '' : c.error).toBe(true)
    expect((await asRole(db, 'service_role', null, `select agree_consultation_for_user('${c.rows[0].id}', '${E2}', '1.2.3.4')`)).ok).toBe(true)
  }, 60_000)

  it('blocks buying a domain for an open request without Looks good, and ties the row to that request', async () => {
    const r = await insertDomain(A, 'need_domain')
    expect(r.ok).toBe(false)
    if (!r.ok) expect(r.error).toMatch(/Looks good/)
    expect((await asRole(db, 'service_role', null, `insert into domain_requests(user_id, kind) values ('${A}', 'need_domain')`)).ok).toBe(false)
  })

  it('connecting a domain the customer owns is not a purchase: allowed and tied to the request', async () => {
    const r = await insertDomain(A, 'have_domain')
    expect(r.ok).toBe(true)
    expect(r.rows[0].website_request_id).toBe(req.A)
  })

  it('cannot dodge the gate by switching an own-domain row to a purchase', async () => {
    const r = await asRole(db, 'service_role', null, `update domain_requests set kind = 'need_domain', domain = null where user_id = '${A}'`)
    expect(r.ok).toBe(false)
  })

  it('allowed once agreed', async () => {
    const r = await insertDomain(E2, 'need_domain')
    expect(r.ok, r.ok ? '' : r.error).toBe(true)
    expect(r.rows[0].website_request_id).toBe(req.E)
  })

  it('existing customers (no open request), buyouts and outreach claims are not gated', async () => {
    const b = await insertDomain(B, 'need_domain')
    expect(b.ok).toBe(true)
    expect(b.rows[0].website_request_id).toBeNull()
    expect((await insertDomain(C, 'need_domain')).ok).toBe(true)
    expect((await insertDomain(D, 'need_domain')).ok).toBe(true)
  })

  it("cannot tie a domain row to someone else's request", async () => {
    const r = await insertDomain(B, 'have_domain', req.E)
    expect(r.ok).toBe(false)
  })
})
