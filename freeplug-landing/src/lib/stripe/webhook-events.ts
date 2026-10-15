import 'server-only'

/**
 * Phase 4 L-1: event-level idempotency for the Stripe webhook (public.stripe_webhook_events, service role only).
 * An event is marked processed only after the route finished it without asking for a redelivery, so a 500
 * (Stripe retries) is never skipped later. Every handler is idempotent on its own too (ledger unique on the
 * invoice, keyed emails, keyed Stripe calls), so when the store itself is unavailable the event is processed
 * normally rather than refused; that is logged.
 */
type DbError = { code?: string; message: string } | null
type Q = PromiseLike<{ data: { event_id: string }[] | null; error: DbError }> & { eq(c: string, v: string): Q; limit(n: number): Q }
export type WebhookEventsDb = {
  from(table: 'stripe_webhook_events'): {
    select(cols: string): Q
    upsert(row: Record<string, unknown>, o: { onConflict: string; ignoreDuplicates: boolean }): PromiseLike<{ error: DbError }>
  }
}

const TABLE = 'stripe_webhook_events'
const msg = (e: unknown) => (e instanceof Error ? e.message : typeof e === 'object' && e && 'message' in e ? String((e as { message: unknown }).message) : String(e))

/** 'processed' = seen and finished before; 'new' = run it; 'unknown' = the store failed (run it, handlers are idempotent). */
export async function webhookEventState(db: WebhookEventsDb, eventId: string): Promise<'processed' | 'new' | 'unknown'> {
  try {
    const { data, error } = await db.from(TABLE).select('event_id').eq('event_id', eventId).limit(1)
    if (error) throw error
    return data && data.length > 0 ? 'processed' : 'new'
  } catch (e) {
    console.error('[webhook/stripe] processed-event lookup failed; processing (handlers are idempotent)', eventId, msg(e))
    return 'unknown'
  }
}

/** Record a finished event. Never throws: a failure only means a redelivery runs the idempotent handlers again. */
export async function markWebhookEventProcessed(db: WebhookEventsDb, eventId: string, type: string): Promise<void> {
  try {
    const { error } = await db.from(TABLE).upsert({ event_id: eventId, event_type: type }, { onConflict: 'event_id', ignoreDuplicates: true })
    if (error) throw error
  } catch (e) {
    console.error('[webhook/stripe] could not mark the event processed', eventId, msg(e))
  }
}
