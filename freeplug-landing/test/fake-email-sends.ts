/**
 * In-memory stand-in for public.email_sends and its two RPCs (email_send_claim / email_send_finish),
 * with the same rules as the SQL in supabase/migrations/20261003160000_email_sends.sql (checked against
 * a real Postgres 17 by /workspace/owen/email-sends-pgtest/run-throwaway.sh). Each RPC call is atomic,
 * like the single SQL statement it mirrors. The clock is controllable.
 */
export type FakeEmailSendRow = {
  id: string
  stripe_event_id: string
  template: string
  status: 'pending' | 'sent' | 'failed'
  resend_id: string | null
  attempts: number
  last_error: string | null
  created_at: number
  updated_at: number
}

export function createFakeEmailSends() {
  const rows = new Map<string, FakeEmailSendRow>()
  let clock = Date.parse('2026-10-03T16:00:00Z')
  let seq = 0
  const state = {
    rows,
    /** 'error' = the RPC returns a PostgREST error; 'throw' = the client throws (e.g. no service role). */
    claimFailure: null as null | 'error' | 'throw',
    calls: [] as string[],
    advance(ms: number) {
      clock += ms
    },
    byEvent(eventId: string, template = 'subscription-cancelled') {
      return rows.get(`${eventId}|${template}`)
    },
    async rpc(fn: string, args: Record<string, unknown>) {
      state.calls.push(fn)
      if (fn === 'email_send_claim') {
        if (state.claimFailure === 'throw') throw new Error('Missing SUPABASE_SERVICE_ROLE_KEY')
        if (state.claimFailure === 'error') return { data: null, error: { code: '08006', message: 'connection refused' } }
        const key = `${args.p_stripe_event_id}|${args.p_template}`
        const existing = rows.get(key)
        if (!existing) {
          const row: FakeEmailSendRow = {
            id: `00000000-0000-4000-8000-${String(++seq).padStart(12, '0')}`,
            stripe_event_id: String(args.p_stripe_event_id),
            template: String(args.p_template),
            status: 'pending',
            resend_id: null,
            attempts: 1,
            last_error: null,
            created_at: clock,
            updated_at: clock,
          }
          rows.set(key, row)
          return { data: [{ id: row.id, attempts: row.attempts }], error: null }
        }
        const stale = existing.status === 'pending' && existing.updated_at < clock - 15 * 60_000
        if (existing.status === 'failed' || stale) {
          Object.assign(existing, { status: 'pending', attempts: existing.attempts + 1, last_error: null, updated_at: clock })
          return { data: [{ id: existing.id, attempts: existing.attempts }], error: null }
        }
        return { data: [], error: null }
      }
      if (fn === 'email_send_finish') {
        const row = [...rows.values()].find((r) => r.id === args.p_id)
        if (!row || row.status !== 'pending') return { data: false, error: null }
        if (args.p_status === 'sent') Object.assign(row, { status: 'sent', resend_id: args.p_resend_id ?? null, last_error: null })
        else Object.assign(row, { status: 'failed', last_error: String(args.p_error ?? 'failed').slice(0, 200) })
        row.updated_at = clock
        return { data: true, error: null }
      }
      return { data: null, error: { code: 'PGRST202', message: `unknown function ${fn}` } }
    },
  }
  return state
}
