// @vitest-environment node
import { beforeEach, describe, expect, it, vi } from 'vitest'

type Row = Record<string, unknown>
const st = vi.hoisted(() => ({
  user: { id: 'u1', email: 'client@example.test' } as { id: string; email: string } | null,
  request: null as Row | null,
  consultation: null as Row | null,
  writes: [] as { table: string; op: string; values: Row }[],
  rpcs: [] as { fn: string; args: Row }[],
  rpcError: null as { message: string } | null,
  mails: [] as { to: string; template: string }[],
}))

function table(name: string) {
  let op = 'select'
  let values: Row = {}
  const q: Record<string, unknown> = {}
  const self = () => q
  Object.assign(q, {
    select: self, eq: self, in: self, order: self, limit: self,
    insert: (v: Row) => { op = 'insert'; values = v; st.writes.push({ table: name, op, values: v }); return q },
    update: (v: Row) => { op = 'update'; values = v; st.writes.push({ table: name, op, values: v }); return q },
    maybeSingle: async () => ({ data: name === 'website_requests' ? st.request : st.consultation, error: null }),
    single: async () => ({ data: op === 'insert' ? { id: 'c-new', ...values } : st.consultation, error: null }),
    then: (res: (v: unknown) => void) => res({ data: null, error: null }),
  })
  return q
}

vi.mock('@/lib/supabase/server', () => ({
  createClient: async () => ({ auth: { getUser: async () => ({ data: { user: st.user } }) }, from: table }),
}))
vi.mock('@/lib/supabase/admin', () => ({
  createAdminClient: () => ({
    from: table,
    rpc: async (fn: string, args: Row) => {
      st.rpcs.push({ fn, args })
      return { data: st.rpcError ? null : '2026-10-23T01:10:00Z', error: st.rpcError }
    },
  }),
}))
vi.mock('next/cache', () => ({ revalidatePath: vi.fn() }))
vi.mock('next/headers', () => ({
  headers: async () => new Headers({ 'x-forwarded-for': '203.0.113.9, 10.0.0.1', 'user-agent': 'vitest' }),
}))
class Redirect extends Error {}
vi.mock('next/navigation', () => ({ redirect: (to: string) => { throw new Redirect(to) } }))
vi.mock('@/lib/consultation/mail', () => ({
  TEAM_INBOX: 'fplgn.dev.clients@gmail.com',
  sendConsultationMail: async (p: { to: string; template: string }) => { st.mails.push({ to: p.to, template: p.template }); return { success: true, id: 'logged', logged: true } },
}))

import { agreeToSummary, bookLiveSession, saveConsultationForm } from './actions'

const COMPLETE = {
  site_type: 'service', page_count: 6, template_choice: 'bold', content_source: 'some', photo_source: 'own',
  domain_path: 'freeplug', forms: ['contact'], booking: 'none', payments: 'none', plan: 'starter', timeline: 'asap',
}

const fd = (o: Record<string, string | string[]>) => {
  const f = new FormData()
  for (const [k, v] of Object.entries(o)) for (const x of Array.isArray(v) ? v : [v]) f.append(k, x)
  return f
}
const redirectTo = async (p: Promise<unknown>) => {
  try { await p } catch (e) { if (e instanceof Redirect) return e.message; throw e }
  return null
}

beforeEach(() => {
  st.user = { id: 'u1', email: 'client@example.test' }
  st.request = { id: 'r1', status: 'submitted', business_name: 'Biz', is_buyout: false }
  st.consultation = null
  st.writes = []
  st.rpcs = []
  st.rpcError = null
  st.mails = []
})

describe('path B: live booking', () => {
  it('phone and text need the consent box', async () => {
    const r = await bookLiveSession({}, fd({ live_method: 'text', contact_number: '+1 555 123 4567', booked_at: '2026-10-24T15:00:00Z' }))
    expect(r.error).toMatch(/tick the box/)
    expect(st.writes).toHaveLength(0)
  })
  it('needs a time and a valid number (webcam needs no number)', async () => {
    expect((await bookLiveSession({}, fd({ live_method: 'phone', contact_number: '12', consent: 'on', booked_at: '2026-10-24T15:00:00Z' }))).error).toMatch(/valid phone/)
    expect((await bookLiveSession({}, fd({ live_method: 'webcam' }))).error).toMatch(/Pick a time/)
  })
  it('books, logs consent with the consent text, IP and UA, moves to consultation and alerts the team (logged)', async () => {
    const to = await redirectTo(bookLiveSession({}, fd({ live_method: 'phone', contact_number: '(555) 123-4567', consent: 'on', booked_at: '2026-10-24T15:00:00Z' })))
    expect(to).toBe('/dashboard/consultation/live?booked=1')
    const consult = st.writes.find((w) => w.table === 'consultations')!
    expect(consult.values).toMatchObject({ path: 'live', live_method: 'phone', booked_at: '2026-10-24T15:00:00.000Z', prepared_by: 'client' })
    const consent = st.writes.find((w) => w.table === 'consultation_consents')!
    expect(consent.values).toMatchObject({ channel: 'phone', phone_number: '(555) 123-4567', ip: '203.0.113.9', user_agent: 'vitest' })
    expect(String(consent.values.consent_text)).toMatch(/may call me/)
    expect(st.writes.find((w) => w.table === 'website_requests')?.values).toMatchObject({ status: 'consultation' })
    expect(st.mails).toEqual([{ to: 'fplgn.dev.clients@gmail.com', template: 'consultation-live-booked-team' }])
  })
})

describe('path A: details form', () => {
  beforeEach(() => {
    st.request = { id: 'r1', status: 'consultation', business_name: 'Biz', is_buyout: false }
    st.consultation = { id: 'c1', path: 'form', agreed_at: null, ready_for_review_at: null, checklist: {} }
  })
  it('saves a partial draft', async () => {
    const r = await saveConsultationForm({}, fd({ intent: 'save', site_type: 'retail' }))
    expect(r).toEqual({ saved: true })
    expect(st.writes[0].values).toMatchObject({ checklist: { site_type: 'retail' }, ready_for_review_at: null })
  })
  it('refuses review until every required answer is in', async () => {
    const r = await saveConsultationForm({}, fd({ intent: 'review', site_type: 'retail' }))
    expect(r.error).toMatch(/^Please answer: Number of pages/)
    expect(st.writes).toHaveLength(0)
  })
  it('sends a complete form for review', async () => {
    const f = fd({ intent: 'review', ...Object.fromEntries(Object.entries(COMPLETE).map(([k, v]) => [k, Array.isArray(v) ? v : String(v)])) })
    expect(await redirectTo(saveConsultationForm({}, f))).toBe('/dashboard/consultation/summary')
    expect(st.writes[0].values.ready_for_review_at).toBeTruthy()
  })
  it('agreed consultations are locked', async () => {
    st.consultation = { ...st.consultation!, agreed_at: '2026-10-22T00:00:00Z' }
    expect((await saveConsultationForm({}, fd({ intent: 'save' }))).error).toMatch(/agreed/)
  })
})

describe('"Looks good" gate', () => {
  beforeEach(() => {
    st.request = { id: 'r1', status: 'consultation', business_name: 'Biz', is_buyout: false }
  })
  it('refuses when the summary is not ready', async () => {
    st.consultation = { id: 'c1', path: 'live', agreed_at: null, ready_for_review_at: null, checklist: COMPLETE }
    expect((await agreeToSummary()).error).toMatch(/not ready/)
    expect(st.rpcs).toHaveLength(0)
  })
  it('refuses an incomplete checklist', async () => {
    st.consultation = { id: 'c1', path: 'form', agreed_at: null, ready_for_review_at: 'x', checklist: { site_type: 'retail' } }
    expect((await agreeToSummary()).error).toMatch(/not ready/)
  })
  it('agrees through the service-role RPC with the client IP, then alerts the team and the client (logged only)', async () => {
    st.consultation = { id: 'c1', path: 'form', agreed_at: null, ready_for_review_at: 'x', checklist: COMPLETE }
    expect(await redirectTo(agreeToSummary())).toBe('/dashboard/consultation/summary?agreed=1')
    expect(st.rpcs).toEqual([{ fn: 'agree_consultation_for_user', args: { p_consultation_id: 'c1', p_user_id: 'u1', p_ip: '203.0.113.9' } }])
    expect(st.mails.map((m) => m.template)).toEqual(['consultation-agreed-team', 'consultation-agreed-client'])
    expect(st.mails[0].to).toBe('fplgn.dev.clients@gmail.com')
  })
  it('a database refusal sends no emails', async () => {
    st.consultation = { id: 'c1', path: 'form', agreed_at: null, ready_for_review_at: 'x', checklist: COMPLETE }
    st.rpcError = { message: 'This summary is not ready to agree yet.' }
    expect((await agreeToSummary()).error).toMatch(/not ready/)
    expect(st.mails).toHaveLength(0)
  })
  it('buyout requests have no consultation', async () => {
    st.request = { id: 'r1', status: 'submitted', business_name: 'Biz', is_buyout: true }
    expect((await agreeToSummary()).error).toMatch(/Submit a website request first/)
  })
})
