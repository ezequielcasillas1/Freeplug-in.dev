import 'server-only'
import { createAdminClient } from '@/lib/supabase/admin'
import { sendMail } from '@/lib/email/mailer'
import { adminAlertRecipients } from '@/lib/change-requests/alert'
import { templateDbNow } from '../server'
import { writeOutbox } from './outbox'
import { headerSafe } from './escape'
import type { Candidate, ShortlistRow } from './score'
import type { ItemDetails, NotifyDeps, OutMail, QueueRow, RequestContext, SendResult } from './notify'

/**
 * Real wiring (service role, server only). Transport: Resend ONLY when NODE_ENV=production; anywhere
 * else every email (and alert) goes to the file outbox and nothing real is sent.
 */
export function isRealSendEnabled(): boolean {
  return process.env.NODE_ENV === 'production' && process.env.PICKER_NOTIFY_OUTBOX !== '1'
}

export function adminNotifyEmail(): string | null {
  const v = process.env.ADMIN_NOTIFY_EMAIL?.trim()
  return v && /^[^\s@,]+@[^\s@,]+$/.test(v) ? v : null
}

async function transport(m: OutMail, kind: 'email' | 'alert' = 'email'): Promise<SendResult> {
  if (!isRealSendEnabled()) return writeOutbox(m, kind)
  const r = await sendMail({ to: m.to, subject: m.subject, html: m.html, text: m.text, replyTo: null, idempotencyKey: m.idempotencyKey, template: `picker-notify-${kind}` })
  return r.success ? { ok: true, id: r.id } : { ok: false, error: `${r.reason}` }
}

type ItemRow = {
  id: number | string; name: string; author: string | null; platform: string | null; url: string | null
  preview_image_url: string | null; tags: string[] | null; auto_niches: string[] | null; rating: number | string | null
  sales: number | null; published_at: string | null; updated_at: string | null; saleable_on_elements: boolean | null
  status: string; price_cents: number | null
}
const ITEM_COLS = 'id, name, author, platform, url, preview_image_url, tags, auto_niches, rating, sales, published_at, updated_at, saleable_on_elements, status, price_cents'
function toItem(r: ItemRow): ItemDetails {
  return {
    id: Number(r.id), name: r.name, author: r.author, platform: r.platform, url: r.url, previewImageUrl: r.preview_image_url,
    tags: r.tags ?? [], autoNiches: r.auto_niches ?? [], rating: r.rating == null ? null : Number(r.rating), sales: r.sales,
    publishedAt: r.published_at, updatedAt: r.updated_at, onElements: r.saleable_on_elements, status: r.status, priceCents: r.price_cents,
  }
}
type QRow = { id: number | string; request_id: string; event: QueueRow['event']; pick_version: number; due_at: string; attempts: number }

export function notifyDeps(): NotifyDeps {
  const db = createAdminClient()
  const must = <T,>(r: { data: T; error: unknown }, what: string): T => {
    if (r.error) throw new Error(`${what} failed`)
    return r.data
  }
  return {
    now: () => templateDbNow(db),
    bumpVersion: async (id) => Number(must(await db.rpc('template_pick_bump_version', { p_request_id: id }), 'version bump')),
    loadContext: async (id): Promise<RequestContext | null> => {
      const r = must(
        await db.from('website_requests')
          .select('id, business_name, business_type, template_choice, envato_item_id, pasted_template_url, template_first_picked_at, template_unlocked_until, template_picked_at, notes')
          .eq('id', id).maybeSingle(),
        'request load',
      ) as Record<string, unknown> | null
      if (!r) return null
      return {
        id: String(r.id), businessName: String(r.business_name ?? ''), businessType: (r.business_type as string) ?? null,
        choice: (r.template_choice as string) ?? null, envatoItemId: r.envato_item_id == null ? null : Number(r.envato_item_id),
        pastedUrl: (r.pasted_template_url as string) ?? null, firstPickedAt: (r.template_first_picked_at as string) ?? null,
        unlockedUntil: (r.template_unlocked_until as string) ?? null, pickedAt: (r.template_picked_at as string) ?? null,
        notes: (r.notes as string) ?? null,
        // website_requests has no services column; services come from the notes text for now.
        services: [],
      }
    },
    lookupItem: async (id) => {
      const r = must(await db.from('envato_items').select(ITEM_COLS).eq('id', id).maybeSingle(), 'item lookup') as ItemRow | null
      return r ? toItem(r) : null
    },
    hasPickedEvent: async (id) =>
      ((must(await db.from('template_pick_notify').select('id').eq('request_id', id).eq('event', 'picked').limit(1), 'queue read') as unknown[]) ?? []).length > 0,
    enqueue: async (row) => {
      must(await db.from('template_pick_notify').upsert(
        { request_id: row.requestId, event: row.event, pick_version: row.pickVersion, due_at: row.dueAt },
        { onConflict: 'request_id,event,pick_version', ignoreDuplicates: true },
      ), 'enqueue')
    },
    upsertPendingChange: async (requestId, pickVersion, dueAt) => {
      const upd = must(await db.from('template_pick_notify').update({ pick_version: pickVersion, due_at: dueAt, updated_at: new Date().toISOString() })
        .eq('request_id', requestId).eq('event', 'changed').is('sent_at', null).select('id'), 'debounce update') as unknown[]
      if ((upd ?? []).length > 0) return
      const ins = await db.from('template_pick_notify').insert({ request_id: requestId, event: 'changed', pick_version: pickVersion, due_at: dueAt })
      if (ins.error) {
        // lost a race with another change: move that row instead
        must(await db.from('template_pick_notify').update({ pick_version: pickVersion, due_at: dueAt })
          .eq('request_id', requestId).eq('event', 'changed').is('sent_at', null), 'debounce retry')
      }
    },
    cancelPendingChange: async (requestId) => {
      must(await db.from('template_pick_notify').update({ sent_at: new Date().toISOString(), last_error: 'superseded by team_pick' })
        .eq('request_id', requestId).eq('event', 'changed').is('sent_at', null), 'cancel change')
    },
    listDue: async (now) =>
      ((must(await db.from('template_pick_notify').select('id, request_id, event, pick_version, due_at, attempts')
        .is('sent_at', null).lte('due_at', now.toISOString()).order('due_at').limit(50), 'due list') as QRow[]) ?? [])
        .map((q) => ({ id: Number(q.id), requestId: q.request_id, event: q.event, pickVersion: q.pick_version, dueAt: q.due_at, attempts: q.attempts })),
    markSent: async (id, at) => {
      must(await db.from('template_pick_notify').update({ sent_at: at.toISOString(), updated_at: new Date().toISOString() }).eq('id', id), 'mark sent')
    },
    markFailed: async (id, error) => {
      const cur = must(await db.from('template_pick_notify').select('attempts').eq('id', id).maybeSingle(), 'attempts') as { attempts: number } | null
      must(await db.from('template_pick_notify').update({ attempts: (cur?.attempts ?? 0) + 1, last_error: error.slice(0, 300), updated_at: new Date().toISOString() }).eq('id', id), 'mark failed')
    },
    listCandidates: async (type): Promise<Candidate[]> => {
      // On Elements only; type-tagged plus general (null/empty/other_local) templates.
      const rows = must(await db.from('envato_items').select(ITEM_COLS).eq('status', 'active').eq('saleable_on_elements', true)
        .or(`auto_niches.cs.{${type}},auto_niches.is.null,auto_niches.eq.{},auto_niches.eq.{other_local}`).limit(500), 'candidates') as ItemRow[]
      return (rows ?? []).map(toItem)
    },
    listShortlist: async (type) =>
      ((must(await db.from('template_shortlist').select('envato_item_id, niche, verify_status, active').eq('niche', type), 'shortlist') as ShortlistRow[]) ?? [])
        .map((r) => ({ ...r, envato_item_id: Number(r.envato_item_id) })),
    saveSuggestions: async (id, s) => {
      must(await db.from('website_requests').update({ team_pick_suggestions: s }).eq('id', id), 'save suggestions')
    },
    send: (m) => transport(m),
    alert: async (message) => {
      const to = adminAlertRecipients()[0] ?? adminNotifyEmail()
      console.error('[picker-notify] ALERT', message)
      if (!to) return
      await transport({ to, subject: headerSafe('Picker notify failed'), html: `<pre>${message.replace(/[&<>]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;' })[c]!)}</pre>`, text: message, idempotencyKey: `picker-notify-alert:${Date.now()}` }, 'alert')
    },
    adminTo: adminNotifyEmail,
    log: (m) => console.error(m),
  }
}
