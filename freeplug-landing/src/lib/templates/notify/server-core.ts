import { createAdminClient } from '@/lib/supabase/admin'
import { sendMail } from '@/lib/email/mailer'
import { writeOutbox } from './outbox'
import { getAlarm } from './alarm'
import type { Candidate, ShortlistRow } from './score'
import type { ItemDetails, LogRow, NotifyDeps, OutMail, RequestContext, SendResult } from './notify'

/**
 * Real wiring (service role). No 'server-only' import here so the Durable Object (do.ts, bundled by
 * wrangler) can use it; Next code imports ./server, which adds it. Transport: Resend ONLY when NODE_ENV=production; anywhere
 * else every email (and alert) goes to the file outbox and nothing real is sent.
 */
export function isRealSendEnabled(): boolean {
  return process.env.NODE_ENV === 'production' && process.env.PICKER_NOTIFY_OUTBOX !== '1'
}

export function adminNotifyEmail(): string | null {
  const v = process.env.ADMIN_NOTIFY_EMAIL?.trim()
  return v && /^[^\s@,]+@[^\s@,]+$/.test(v) ? v : null
}

async function transport(m: OutMail): Promise<SendResult> {
  if (!isRealSendEnabled()) return writeOutbox(m)
  const r = await sendMail({ to: m.to, subject: m.subject, html: m.html, text: m.text, replyTo: null, idempotencyKey: m.idempotencyKey, template: 'picker-notify' })
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
type LRow = { id: number | string; request_id: string; event: LogRow['event']; pick_version: number; sent_at: string | null; attempts: number; last_error: string | null; updated_at: string }
const LOG_COLS = 'id, request_id, event, pick_version, sent_at, attempts, last_error, updated_at'
const toLog = (r: LRow): LogRow => ({ id: Number(r.id), requestId: r.request_id, event: r.event, pickVersion: r.pick_version, sentAt: r.sent_at, attempts: r.attempts, lastError: r.last_error, updatedAt: r.updated_at })

/** DB clock via public.template_pick_db_now() (service role only). */
async function dbNow(db: ReturnType<typeof createAdminClient>): Promise<Date> {
  const { data, error } = await db.rpc('template_pick_db_now')
  if (error || typeof data !== 'string') throw new Error('db clock failed')
  const d = new Date(data)
  if (!Number.isFinite(d.getTime())) throw new Error('db clock failed')
  return d
}

export function notifyDeps(): NotifyDeps {
  const db = createAdminClient()
  const must = <T,>(r: { data: T; error: unknown }, what: string): T => {
    if (r.error) throw new Error(`${what} failed`)
    return r.data
  }
  return {
    now: () => dbNow(db),
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
      }
    },
    lookupItem: async (id) => {
      const r = must(await db.from('envato_items').select(ITEM_COLS).eq('id', id).maybeSingle(), 'item lookup') as ItemRow | null
      return r ? toItem(r) : null
    },
    alarm: getAlarm(),
    log: {
      wasSent: async (id, event, v) =>
        ((must(await db.from('template_pick_notify').select('id').eq('request_id', id).eq('event', event).eq('pick_version', v).not('sent_at', 'is', null).limit(1), 'log read') as unknown[]) ?? []).length > 0,
      hasPicked: async (id) =>
        ((must(await db.from('template_pick_notify').select('id').eq('request_id', id).eq('event', 'picked').limit(1), 'log read') as unknown[]) ?? []).length > 0,
      record: async (r) => {
        const key = { request_id: r.requestId, event: r.event, pick_version: r.pickVersion }
        const cur = must(await db.from('template_pick_notify').select('id, attempts').match(key).maybeSingle(), 'log read') as { id: number; attempts: number } | null
        const patch = r.ok
          ? { sent_at: r.at.toISOString(), last_error: null, updated_at: new Date().toISOString() }
          : { attempts: (cur?.attempts ?? 0) + 1, last_error: (r.error ?? 'failed').slice(0, 300), updated_at: new Date().toISOString() }
        if (cur) must(await db.from('template_pick_notify').update(patch).eq('id', cur.id), 'log update')
        else must(await db.from('template_pick_notify').insert({ ...key, ...patch }), 'log insert')
      },
      listFailed: async () =>
        ((must(await db.from('template_pick_notify').select(LOG_COLS).is('sent_at', null).order('updated_at', { ascending: false }).limit(100), 'log list') as LRow[]) ?? []).map(toLog),
      get: async (id) => {
        const r = must(await db.from('template_pick_notify').select(LOG_COLS).eq('id', id).maybeSingle(), 'log get') as LRow | null
        return r ? toLog(r) : null
      },
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
    adminTo: adminNotifyEmail,
    logError: (m) => console.error(m),
  }
}
