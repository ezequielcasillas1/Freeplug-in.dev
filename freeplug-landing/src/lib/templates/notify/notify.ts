import { isNiche } from '@/lib/envato/niche-tags'
import { PICK_WINDOW_SERVER_MIN } from '../window'
import { pickEmail, teamPickEmail, type Email, type NotifyEvent, type PickDetails } from './emails'
import { elementsSearchUrl, suggestTemplates, type Candidate, type ShortlistRow, type Suggestion } from './score'

/**
 * Admin notify on a saved template pick (Aria scope, Oct 14; Cheke approved). Runs AFTER the pick is
 * saved, outside the request (scheduleAfterResponse), so nothing here can block or undo a pick.
 *
 *   self-pick (envato_catalog / client_pasted / client_purchase): first pick -> 'picked' email now.
 *   a later change -> ONE pending 'changed' row per request, due = last change + 2 min (durable, so the
 *     debounce survives a restart); each further change moves the due time. The processor sends it.
 *   team_pick -> 'team_pick' email now with up to 3 scored suggestions, stored on the request for audit.
 * Idempotency key = request id + event + pick version (queue unique key and the Resend Idempotency-Key).
 * Times come from deps.now() (the DB clock in production; injectable in tests).
 */
export const CHANGE_DEBOUNCE_MS = 2 * 60_000
export const MAX_ATTEMPTS = 5
export const SELF_PICK_CHOICES = ['envato_catalog', 'client_pasted', 'client_purchase'] as const

export type RequestContext = {
  id: string
  businessName: string
  businessType: string | null
  choice: string | null
  envatoItemId: number | null
  pastedUrl: string | null
  firstPickedAt: string | null
  unlockedUntil: string | null
  pickedAt: string | null
  notes: string | null
  services: string[]
}

export type ItemDetails = Candidate & { priceCents: number | null }

export type QueueRow = { id: number; requestId: string; event: NotifyEvent; pickVersion: number; dueAt: string; attempts: number }

export type OutMail = Email & { to: string; idempotencyKey: string }
export type SendResult = { ok: true; id?: string } | { ok: false; error: string }

export type NotifyDeps = {
  now: () => Date | Promise<Date>
  bumpVersion: (requestId: string) => Promise<number>
  loadContext: (requestId: string) => Promise<RequestContext | null>
  lookupItem: (id: number) => Promise<ItemDetails | null>
  hasPickedEvent: (requestId: string) => Promise<boolean>
  /** Insert a queue row; a duplicate (request, event, version) is ignored. */
  enqueue: (row: { requestId: string; event: NotifyEvent; pickVersion: number; dueAt: string }) => Promise<void>
  /** Create or move the one pending 'changed' row for the request. */
  upsertPendingChange: (requestId: string, pickVersion: number, dueAt: string) => Promise<void>
  cancelPendingChange: (requestId: string) => Promise<void>
  listDue: (now: Date) => Promise<QueueRow[]>
  markSent: (id: number, at: Date) => Promise<void>
  markFailed: (id: number, error: string) => Promise<void>
  listCandidates: (type: string) => Promise<Candidate[]>
  listShortlist: (type: string) => Promise<ShortlistRow[]>
  saveSuggestions: (requestId: string, s: { version: number; at: string; suggestions: Suggestion[] }) => Promise<void>
  send: (m: OutMail) => Promise<SendResult>
  alert: (message: string) => Promise<void>
  adminTo: () => string | null
  log?: (msg: string) => void
}

export function idempotencyKey(requestId: string, event: NotifyEvent, version: number): string {
  return `template-pick:${requestId}:${event}:v${version}`
}

export function windowClosesAt(c: Pick<RequestContext, 'firstPickedAt' | 'unlockedUntil'>): Date | null {
  const f = c.firstPickedAt ? Date.parse(c.firstPickedAt) : NaN
  const u = c.unlockedUntil ? Date.parse(c.unlockedUntil) : NaN
  const ends = [Number.isFinite(f) ? f + PICK_WINDOW_SERVER_MIN * 60_000 : NaN, u].filter(Number.isFinite)
  return ends.length ? new Date(Math.max(...ends)) : null
}

const isSelf = (c: string | null) => c != null && (SELF_PICK_CHOICES as readonly string[]).includes(c)

/** Call after a pick is saved. Never throws (errors are logged and alerted). */
export async function onPickSaved(deps: NotifyDeps, requestId: string): Promise<void> {
  try {
    const now = await deps.now()
    const ctx = await deps.loadContext(requestId)
    if (!ctx || !ctx.choice) return
    const version = await deps.bumpVersion(requestId)
    if (ctx.choice === 'team_pick') {
      await deps.cancelPendingChange(requestId)
      await deps.enqueue({ requestId, event: 'team_pick', pickVersion: version, dueAt: now.toISOString() })
    } else if (isSelf(ctx.choice)) {
      if (await deps.hasPickedEvent(requestId)) {
        await deps.upsertPendingChange(requestId, version, new Date(now.getTime() + CHANGE_DEBOUNCE_MS).toISOString())
      } else {
        await deps.enqueue({ requestId, event: 'picked', pickVersion: version, dueAt: now.toISOString() })
      }
    } else return
    await processDue(deps)
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e)
    deps.log?.(`[picker-notify] enqueue failed for ${requestId}: ${msg}`)
    await safeAlert(deps, `Template pick notify could not be queued for request ${requestId}: ${msg}`)
  }
}

async function safeAlert(deps: NotifyDeps, message: string) {
  try {
    await deps.alert(message.slice(0, 500))
  } catch {
    deps.log?.('[picker-notify] admin alert failed')
  }
}

export async function buildEmail(deps: NotifyDeps, row: QueueRow, now: Date): Promise<Email | null> {
  const ctx = await deps.loadContext(row.requestId)
  if (!ctx) return null
  const closes = windowClosesAt(ctx)
  const pickedAt = ctx.pickedAt ? new Date(ctx.pickedAt) : now
  if (row.event === 'team_pick') {
    if (ctx.choice !== 'team_pick') return null
    const type = isNiche(ctx.businessType) ? ctx.businessType : 'other_local'
    const [cands, shortlist] = await Promise.all([deps.listCandidates(type), deps.listShortlist(type)])
    const suggestions = suggestTemplates(cands, { type, services: ctx.services, notes: ctx.notes, shortlist, now })
    await deps.saveSuggestions(row.requestId, { version: row.pickVersion, at: now.toISOString(), suggestions })
    return teamPickEmail({ requestId: ctx.id, businessName: ctx.businessName, businessType: ctx.businessType, pickedAt, windowClosesAt: closes, suggestions })
  }
  if (!isSelf(ctx.choice)) return null // changed to team_pick or cleared since; that event covers it
  const item = ctx.envatoItemId != null ? await deps.lookupItem(ctx.envatoItemId) : null
  const d: PickDetails = {
    requestId: ctx.id,
    businessName: ctx.businessName,
    businessType: ctx.businessType,
    choice: ctx.choice!,
    title: item?.name ?? null,
    author: item?.author ?? null,
    platform: item?.platform ?? null,
    themeforestUrl: item?.url ?? ctx.pastedUrl,
    elementsUrl: item ? (item.onElements ? elementsSearchUrl(item.name) : null) : null,
    previewImageUrl: item?.previewImageUrl ?? null,
    onElements: item ? item.onElements : null,
    priceCents: ctx.choice === 'client_purchase' ? item?.priceCents ?? null : null,
    pickedAt,
    windowClosesAt: closes,
  }
  return pickEmail(row.event, d)
}

/** Send every due queue row. Safe to run repeatedly (manual run, dev timer, or a production cron). */
export async function processDue(deps: NotifyDeps): Promise<{ sent: number; failed: number; skipped: number }> {
  const out = { sent: 0, failed: 0, skipped: 0 }
  const now = await deps.now()
  const to = deps.adminTo()
  const rows = await deps.listDue(now)
  for (const row of rows) {
    if (row.attempts >= MAX_ATTEMPTS) { out.skipped++; continue }
    try {
      if (!to) throw new Error('ADMIN_NOTIFY_EMAIL is not set')
      const email = await buildEmail(deps, row, now)
      if (!email) { await deps.markSent(row.id, now); out.skipped++; continue }
      const res = await deps.send({ ...email, to, idempotencyKey: idempotencyKey(row.requestId, row.event, row.pickVersion) })
      if (!res.ok) throw new Error(res.error)
      await deps.markSent(row.id, now)
      out.sent++
    } catch (e) {
      const msg = (e instanceof Error ? e.message : String(e)).slice(0, 300)
      out.failed++
      deps.log?.(`[picker-notify] send failed ${row.requestId} ${row.event} v${row.pickVersion}: ${msg}`)
      try { await deps.markFailed(row.id, msg) } catch { /* logged above */ }
      await safeAlert(deps, `Template pick email (${row.event}) failed for request ${row.requestId}: ${msg}`)
    }
  }
  return out
}
