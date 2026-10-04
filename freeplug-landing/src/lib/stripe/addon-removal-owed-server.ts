import { createAdminClient } from '@/lib/supabase/admin'
import { sendMail } from '@/lib/email/mailer'
import { sendWebhookEmailOnce } from '@/lib/email/webhook-email-ledger'
import { SUPPORT_EMAIL } from '@/lib/site'
import { parseAddonIds } from '@/lib/plans/addons'
import type { AddonId } from '@/lib/plans/ladder'
import { recordRemovalOwed, removalOwedAlert, type RemovalOwed, type RemovalOwedInput, type RemovalOwedStore } from './addon-removal-owed'

const TABLE = 'addon_removals_owed'
type DbError = { code?: string; message: string } | null
type Row = { id: string; stripe_subscription_id: string; stripe_customer_id: string | null; user_id: string | null; addons: string[]; effective_at: string; source?: string | null }
/** The slice of the Supabase client this store uses (service role). */
type Query = PromiseLike<{ data: Row[] | null; error: DbError }> & {
  eq(col: string, v: string): Query
  is(col: string, v: null): Query
}
export type RemovalOwedDb = {
  from(table: string): {
    select(cols: string): Query
    insert(row: Record<string, unknown>): PromiseLike<{ error: DbError }>
    update(v: Record<string, unknown>): { eq(col: string, v: string): PromiseLike<{ error: DbError }> }
  }
}

const toOwed = (r: Row): RemovalOwed => ({
  id: r.id,
  subscriptionId: r.stripe_subscription_id,
  customerId: r.stripe_customer_id,
  userId: r.user_id,
  addons: parseAddonIds(r.addons) ?? [],
  effectiveAt: new Date(r.effective_at).toISOString(),
  ...(r.source === 'upgrade' || r.source === 'resume' ? { source: r.source } : {}),
})
const fail = (what: string, e: NonNullable<DbError>) => new Error(`${TABLE} ${what}: ${e.code ?? ''} ${e.message}`)

/** addon_removals_owed (migration 20261004092000, add-ons set, LOCAL ONLY until hosted applies it). */
export function supabaseRemovalOwedStore(db: RemovalOwedDb, source: 'upgrade' | 'resume' = 'upgrade'): RemovalOwedStore {
  const open = async (subscriptionId: string) => {
    const { data, error } = await db.from(TABLE).select('id, stripe_subscription_id, stripe_customer_id, user_id, addons, effective_at, source').eq('stripe_subscription_id', subscriptionId).is('cleared_at', null)
    if (error) throw fail('read', error)
    return (data ?? []).map(toOwed)
  }
  const store: RemovalOwedStore = {
    open,
    async save(o) {
      const { error } = await db.from(TABLE).insert({
        stripe_subscription_id: o.subscriptionId,
        stripe_customer_id: o.customerId,
        user_id: o.userId,
        addons: o.addons,
        effective_at: o.effectiveAt,
        source,
      })
      if (!error) return
      if (error.code !== '23505') throw fail('insert', error)
      // One open row per subscription: merge the add-ons into it.
      const [row] = await open(o.subscriptionId)
      if (!row) throw fail('insert', error)
      const addons = [...new Set<AddonId>([...row.addons, ...o.addons])]
      const { error: upErr } = await db.from(TABLE).update({ addons, effective_at: o.effectiveAt, updated_at: new Date().toISOString() }).eq('id', row.id)
      if (upErr) throw fail('merge', upErr)
    },
    async clear(id, how, invoiceId) {
      const now = new Date().toISOString()
      const { error } = await db.from(TABLE).update({ cleared_at: now, cleared_how: how, cleared_invoice_id: invoiceId, updated_at: now }).eq('id', id)
      if (error) throw fail('clear', error)
    },
    async keep(subscriptionId, addon) {
      for (const row of await open(subscriptionId)) {
        if (!row.addons.includes(addon)) continue
        const left = row.addons.filter((a) => a !== addon)
        if (left.length === 0) await store.clear(row.id, 'kept', null)
        else {
          const { error } = await db.from(TABLE).update({ addons: left, updated_at: new Date().toISOString() }).eq('id', row.id)
          if (error) throw fail('keep', error)
        }
      }
    },
  }
  return store
}

/** Add-ons a failed resume left owed on these subscriptions (Plans box, Aria 10:09); [] when none or unreadable. */
export async function resumeRemovalOwed(subscriptionIds: readonly string[], store: RemovalOwedStore = removalOwedStore()): Promise<{ addons: AddonId[]; effectiveAt: string | null }> {
  const addons = new Set<AddonId>()
  let effectiveAt: string | null = null
  for (const id of subscriptionIds) {
    for (const row of await store.open(id)) {
      if (row.source !== 'resume') continue
      for (const a of row.addons) addons.add(a)
      effectiveAt = row.effectiveAt
    }
  }
  return { addons: [...addons], effectiveAt }
}

export const removalOwedStore = (source: 'upgrade' | 'resume' = 'upgrade') =>
  supabaseRemovalOwedStore(createAdminClient() as unknown as RemovalOwedDb, source)

/** Internal alert to us (support inbox) through the app's Resend path; once per owed removal (email ledger). */
export async function sendRemovalOwedAlert(o: RemovalOwedInput): Promise<string> {
  const { subject, text } = removalOwedAlert(o)
  const key = `removal-owed:${o.subscriptionId}:${Math.floor(Date.parse(o.effectiveAt) / 1000)}`
  const outcome = await sendWebhookEmailOnce(key, 'removal-owed-alert', o.subscriptionId, () =>
    sendMail({ to: SUPPORT_EMAIL, subject, text, template: 'removal-owed-alert', idempotencyKey: `${key}:removal-owed-alert` })
  )
  if (outcome === 'send_failed' || outcome === 'claim_error') throw new Error(`removal-owed alert ${outcome}`)
  return outcome
}

/** For changePlanStep / resume: save the flag, then alert us. */
export const recordRemovalOwedNow = (source: 'upgrade' | 'resume') => (o: RemovalOwedInput) =>
  recordRemovalOwed({ store: removalOwedStore(source), alert: sendRemovalOwedAlert }, o)
