import { createAdminClient } from '@/lib/supabase/admin'
import { normalizeEmail } from './token'

export type OptOutSource = 'unsubscribe_page' | 'one_click'
export type OptOut = { email: string; source: OptOutSource; tokenKind: 'signed'; userAgent?: string | null; at?: Date }
export type OptOutStore = {
  record(o: OptOut): Promise<void>
  optedOut(emails: string[]): Promise<Set<string>>
}

/** public.email_opt_outs (migration 20261019090000), service role. */
export const supabaseOptOutStore = (): OptOutStore => ({
  async record(o) {
    // One row per address (unique lowercase email): a replay is ON CONFLICT DO NOTHING; the first opt-out's time stays.
    const { error } = await createAdminClient()
      .from('email_opt_outs')
      .upsert({ email: o.email, source: o.source, token_kind: o.tokenKind, user_agent: o.userAgent?.slice(0, 500) ?? null, opted_out_at: (o.at ?? new Date()).toISOString() }, { onConflict: 'email', ignoreDuplicates: true })
    if (error) throw new Error(error.message)
  },
  async optedOut(emails) {
    const { data, error } = await createAdminClient().rpc('email_opted_out', { p_emails: emails })
    if (error) throw new Error(error.message)
    return new Set(((data ?? []) as { email: string }[]).map((r) => r.email))
  },
})

/** Records an opt-out; repeats are no-ops (one row per normalized email). */
export async function recordOptOut(store: OptOutStore, o: OptOut): Promise<{ ok: true } | { ok: false }> {
  const email = normalizeEmail(o.email)
  if (!email) return { ok: false }
  try {
    await store.record({ ...o, email })
    return { ok: true }
  } catch (e) {
    console.error('[unsubscribe] record failed', e instanceof Error ? e.message : e)
    return { ok: false }
  }
}

/** Dev/review only: no Supabase env locally, so opt-outs go to a JSON-lines file instead. Never in production. */
export async function defaultOptOutStore(): Promise<OptOutStore> {
  const file = process.env.UNSUBSCRIBE_DEV_FILE_STORE
  if (file && process.env.NODE_ENV !== 'production' && !process.env.SUPABASE_SERVICE_ROLE_KEY) {
    const fs = await import('node:fs/promises')
    return {
      async record(o) {
        await fs.appendFile(file, JSON.stringify({ email: o.email, opted_out_at: (o.at ?? new Date()).toISOString(), source: o.source, token_kind: o.tokenKind }) + '\n')
      },
      async optedOut() {
        return new Set()
      },
    }
  }
  return supabaseOptOutStore()
}
