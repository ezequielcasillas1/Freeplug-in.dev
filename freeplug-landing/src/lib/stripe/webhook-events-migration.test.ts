import { readFileSync } from 'node:fs'
import path from 'node:path'
import { describe, expect, it } from 'vitest'

const sql = readFileSync(path.join(__dirname, '../../../supabase/migrations/20261013092000_stripe_webhook_events.sql'), 'utf8')
const code = sql.replace(/--.*$/gm, '')

describe('stripe_webhook_events access (Vera I-f)', () => {
  it('grants service_role select/insert/update/delete explicitly, not via default privileges', () => {
    expect(code).toMatch(/grant select, insert, update, delete on table public\.stripe_webhook_events to service_role;/)
  })
  it('anon and authenticated stay revoked and get no grant; RLS stays on', () => {
    expect(code).toMatch(/revoke all on table public\.stripe_webhook_events from anon;/)
    expect(code).toMatch(/revoke all on table public\.stripe_webhook_events from authenticated;/)
    expect(code).not.toMatch(/grant[^;]*to (anon|authenticated|public)/i)
    expect(code).toMatch(/enable row level security/)
  })
})
