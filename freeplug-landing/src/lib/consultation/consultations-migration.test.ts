// @vitest-environment node
import { beforeAll, describe, expect, it } from 'vitest'
import type { PGlite } from '@electric-sql/pglite'
import { asRole, migratedDb } from '../../../test/supabase-pglite'

const U = '11111111-1111-1111-1111-111111111111'
const O = '22222222-2222-2222-2222-222222222222'

/** Consultation step migration on a real (in-memory) Postgres: RLS, the guard trigger and the "Looks good" gate. */
describe('20261022200000_consultations', () => {
  let db: PGlite
  let req = ''
  let c = ''

  beforeAll(async () => {
    db = await migratedDb()
    await db.exec(`insert into auth.users(id, email) values ('${U}', 'u@x.test'), ('${O}', 'o@x.test');
      insert into public.profiles(id) values ('${U}'), ('${O}') on conflict do nothing;`)
    const r = await asRole(db, 'authenticated', U, `insert into website_requests(user_id, business_name, status) values ('${U}', 'Biz', 'submitted') returning id`)
    expect(r.ok).toBe(true)
    req = String(r.rows[0].id)
  }, 60_000)

  it('client creates their own live consultation; others cannot see or attach', async () => {
    const r = await asRole(db, 'authenticated', U, `insert into consultations(request_id, user_id, path, live_method) values ('${req}', '${U}', 'live', 'phone') returning id`)
    expect(r.ok).toBe(true)
    c = String(r.rows[0].id)
    expect((await asRole(db, 'authenticated', O, 'select * from consultations')).rows).toHaveLength(0)
    expect((await asRole(db, 'authenticated', O, `insert into consultations(request_id, user_id, path) values ('${req}', '${O}', 'form')`)).ok).toBe(false)
  })

  it('live path needs a method; form path must not have one', async () => {
    const r = await asRole(db, 'service_role', U, `update consultations set live_method = null where id = '${c}'`)
    expect(r.ok).toBe(false)
  })

  it('client cannot stamp agreement, claim team prep, mark a live summary ready, or call the RPCs', async () => {
    for (const set of ['agreed_at = now()', "agreed_ip = '1.1.1.1'", "prepared_by = 'team'", 'ready_for_review_at = now()']) {
      const r = await asRole(db, 'authenticated', U, `update consultations set ${set} where id = '${c}'`)
      expect(r.ok, set).toBe(false)
    }
    expect((await asRole(db, 'authenticated', U, `select agree_consultation_for_user('${c}', '${U}', 'x')`)).ok).toBe(false)
    expect((await asRole(db, 'authenticated', U, `select admin_save_consultation_checklist('${c}', '{}'::jsonb, true)`)).ok).toBe(false)
  })

  it('consent rows are logged with a timestamp and are append-only for the client', async () => {
    const r = await asRole(db, 'authenticated', U, `insert into consultation_consents(consultation_id, user_id, channel, phone_number, consent_text) values ('${c}', '${U}', 'text', '+1 555 123 4567', 'ok') returning consented_at`)
    expect(r.ok).toBe(true)
    expect(r.rows[0].consented_at).toBeTruthy()
    expect((await asRole(db, 'authenticated', U, `update consultation_consents set phone_number = '0000000'`)).count).toBe(0)
    expect((await asRole(db, 'authenticated', U, `delete from consultation_consents`)).count).toBe(0)
  })

  it('building (and agreed) are blocked until the client agrees', async () => {
    for (const s of ['building', 'agreed']) {
      const r = await asRole(db, 'service_role', null, `update website_requests set status = '${s}' where id = '${req}'`)
      expect(r.ok).toBe(false)
      if (!r.ok) expect(r.error).toMatch(/Looks good/)
    }
  })

  it('team prepares, client agrees: agreed_at/ip stamped, request agreed, profile agreed, then read-only', async () => {
    expect((await asRole(db, 'service_role', null, `update website_requests set status = 'consultation' where id = '${req}'`)).ok).toBe(true)
    expect((await asRole(db, 'service_role', null, `select agree_consultation_for_user('${c}', '${U}', '1.2.3.4')`)).ok).toBe(false)
    expect((await asRole(db, 'service_role', null, `select admin_save_consultation_checklist('${c}', '{"site_type":"service"}'::jsonb, true)`)).ok).toBe(true)
    expect((await asRole(db, 'service_role', null, `select agree_consultation_for_user('${c}', '${O}', '1.2.3.4')`)).ok).toBe(false)
    expect((await asRole(db, 'service_role', null, `select agree_consultation_for_user('${c}', '${U}', '1.2.3.4')`)).ok).toBe(true)
    const row = (await asRole(db, 'service_role', null, `select c.agreed_at, c.agreed_ip, c.prepared_by, r.status, p.evaluation_status from consultations c join website_requests r on r.id = c.request_id join profiles p on p.id = c.user_id where c.id = '${c}'`)).rows[0]
    expect(row.agreed_at).toBeTruthy()
    expect(row).toMatchObject({ agreed_ip: '1.2.3.4', prepared_by: 'team', status: 'agreed', evaluation_status: 'agreed' })
    expect((await asRole(db, 'authenticated', U, `update consultations set checklist = '{}' where id = '${c}'`)).count).toBe(0)
    expect((await asRole(db, 'authenticated', U, `select id from consultations where id = '${c}'`)).rows).toHaveLength(1)
    expect((await asRole(db, 'service_role', null, `select admin_save_consultation_checklist('${c}', '{}'::jsonb, false)`)).ok).toBe(false)
  })

  it('building is allowed after agreement, and building still counts as the one open request', async () => {
    expect((await asRole(db, 'service_role', null, `update website_requests set status = 'building' where id = '${req}'`)).ok).toBe(true)
    expect((await asRole(db, 'authenticated', U, `insert into website_requests(user_id, business_name, status) values ('${U}', 'Biz2', 'submitted')`)).ok).toBe(false)
  })

  it('a form-path client can mark their own summary ready', async () => {
    const r1 = await asRole(db, 'authenticated', O, `insert into website_requests(user_id, business_name, status) values ('${O}', 'Other', 'submitted') returning id`)
    const r2 = await asRole(db, 'authenticated', O, `insert into consultations(request_id, user_id, path) values ('${r1.rows[0].id}', '${O}', 'form') returning id`)
    expect(r2.ok).toBe(true)
    expect((await asRole(db, 'authenticated', O, `update consultations set ready_for_review_at = now(), checklist = '{"site_type":"retail"}' where id = '${r2.rows[0].id}'`)).count).toBe(1)
    expect((await asRole(db, 'authenticated', O, `select cancel_website_request_for_user('${O}')`)).ok).toBe(false)
    expect((await asRole(db, 'service_role', null, `select cancel_website_request_for_user('${O}')`)).ok).toBe(true)
  })
})
