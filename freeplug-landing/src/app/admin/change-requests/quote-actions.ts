'use server'

import { revalidatePath } from 'next/cache'
import { z } from 'zod'
import { assertAdminAccess } from '@/lib/admin/guard'
import { createAdminClient } from '@/lib/supabase/admin'
import { getStripe } from '@/lib/stripe/server'
import {
  QUOTE_DESCRIPTION_MAX,
  assertTestModeKey,
  parseQuoteAmount,
  quoteSentToast,
  sendQuote,
  voidQuote,
  type MaintenanceQuote,
  type QuoteStore,
  type QuoteStripe,
} from '@/lib/maintenance-quotes/quotes'

export type QuoteActionResult = { ok: true; message?: string } | { ok: false; error: string }
const uuid = z.string().uuid()

function quoteStore(admin: ReturnType<typeof createAdminClient>): QuoteStore {
  return {
    async get(id) {
      const { data } = await admin.from('maintenance_quotes').select('*').eq('id', id).maybeSingle()
      return (data as MaintenanceQuote | null) ?? null
    },
    async claimSend(id, now) {
      const { data } = await admin
        .from('maintenance_quotes')
        .update({ send_started_at: now, updated_at: now })
        .eq('id', id)
        .eq('status', 'draft')
        .is('send_started_at', null)
        .select('id')
      return (data?.length ?? 0) === 1
    },
    async releaseSend(id) {
      await admin.from('maintenance_quotes').update({ send_started_at: null }).eq('id', id).eq('status', 'draft')
    },
    async markSent(id, invoiceId, now) {
      await admin.from('maintenance_quotes').update({ status: 'unpaid', stripe_invoice_id: invoiceId, sent_at: now, updated_at: now }).eq('id', id)
    },
    async markVoid(id, now) {
      await admin.from('maintenance_quotes').update({ status: 'void', voided_at: now, updated_at: now }).eq('id', id)
    },
    async stripeCustomerFor(userId) {
      const { data } = await admin.from('profiles').select('stripe_customer_id').eq('id', userId).maybeSingle()
      return (data?.stripe_customer_id as string | null | undefined) ?? null
    },
  }
}

/** Save draft: creates or updates the request's live draft (amount $50-$100, short description). */
export async function adminSaveQuoteDraft(changeRequestId: string, amount: string, description: string): Promise<QuoteActionResult> {
  await assertAdminAccess()
  if (!uuid.safeParse(changeRequestId).success) return { ok: false, error: 'Invalid request id' }
  const parsed = parseQuoteAmount(amount)
  if (!parsed.ok) return { ok: false, error: parsed.error }
  const desc = String(description ?? '').trim()
  if (!desc || desc.length > QUOTE_DESCRIPTION_MAX) return { ok: false, error: `Add a short description (up to ${QUOTE_DESCRIPTION_MAX} characters).` }
  const admin = createAdminClient()
  const { data: cr } = await admin.from('change_requests').select('id, user_id').eq('id', changeRequestId).maybeSingle()
  if (!cr) return { ok: false, error: 'Change request not found' }
  const { data: live } = await admin.from('maintenance_quotes').select('id, status').eq('change_request_id', changeRequestId).neq('status', 'void').maybeSingle()
  const now = new Date().toISOString()
  if (live && live.status !== 'draft') return { ok: false, error: 'This quote was already sent. Void it to make a new one.' }
  const { error } = live
    ? await admin.from('maintenance_quotes').update({ amount_cents: parsed.cents, description: desc, updated_at: now }).eq('id', live.id).eq('status', 'draft')
    : await admin.from('maintenance_quotes').insert({ change_request_id: changeRequestId, user_id: cr.user_id, amount_cents: parsed.cents, description: desc })
  if (error) return { ok: false, error: error.message }
  revalidatePath('/admin/change-requests')
  return { ok: true, message: 'Draft saved.' }
}

/** Send (after the confirm step): Stripe TEST-mode invoice. A second Send is a no-op. */
export async function adminSendQuote(quoteId: string): Promise<QuoteActionResult> {
  await assertAdminAccess()
  if (!uuid.safeParse(quoteId).success) return { ok: false, error: 'Invalid quote id' }
  try {
    assertTestModeKey(process.env.STRIPE_SECRET_KEY?.trim())
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : String(e) }
  }
  const now = new Date()
  const res = await sendQuote(quoteStore(createAdminClient()), getStripe() as unknown as QuoteStripe, quoteId, now)
  revalidatePath('/admin/change-requests')
  if (!res.ok) return res
  return { ok: true, message: res.outcome === 'sent' ? quoteSentToast(now) : 'Already sent. Nothing changed.' }
}

export async function adminVoidQuote(quoteId: string): Promise<QuoteActionResult> {
  await assertAdminAccess()
  if (!uuid.safeParse(quoteId).success) return { ok: false, error: 'Invalid quote id' }
  try {
    assertTestModeKey(process.env.STRIPE_SECRET_KEY?.trim())
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : String(e) }
  }
  const res = await voidQuote(quoteStore(createAdminClient()), getStripe() as unknown as QuoteStripe, quoteId)
  revalidatePath('/admin/change-requests')
  return res.ok ? { ok: true, message: 'Quote voided.' } : res
}
