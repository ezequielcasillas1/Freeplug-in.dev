import { isNiche } from '@/lib/envato/niche-tags'
import { PICK_WINDOW_SERVER_MIN } from '../window'
import { pickEmail, teamPickEmail, type Email, type NotifyEvent, type PickDetails } from './emails'
import { elementsSearchUrl, suggestTemplates, type Candidate, type ShortlistRow, type Suggestion } from './score'

/**
 * Admin notify on a saved template pick (Aria scope, Oct 14; Aria rulings on 81bce67). Runs AFTER the
 * pick is saved (scheduleAfterResponse), so nothing here can block or undo a pick.
 *
 *   first self-pick (envato_catalog / client_pasted; client_purchase tolerated, built elsewhere) -> 'picked' now.
 *   a later change -> the per-request alarm (a Cloudflare Durable Object alarm in production) is RESET to
 *     now + 2 min on every change; when it fires, ONE 'changed' email with the latest state goes out.
 *   team_pick -> 'team_pick' now with up to 3 scored suggestions (stored on the request for audit); any
 *     pending change alarm is cancelled.
 * Idempotency key = request id + event + pick version (also the Resend Idempotency-Key). A failed send is
 * logged and recorded in the notify log; the admin re-sends it from /admin/notify-outbox. No alert email.
 * Times come from deps.now() (the DB clock in production; injectable in tests).
 */
export const CHANGE_DEBOUNCE_MS = 2 * 60_000
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
}

export type ItemDetails = Candidate & { priceCents: number | null }

export type OutMail = Email & { to: string; idempotencyKey: string }
export type SendResult = { ok: true; id?: string } | { ok: false; error: string }

/** Per-request debounce alarm. Production: Durable Object (do.ts). Local/tests: memory (alarm-memory.ts). */
export interface PickAlarm {
  /** Set (or move) this request's alarm to fireAt, remembering the latest pick version. */
  reset(requestId: string, pickVersion: number, fireAt: Date): Promise<void>
  cancel(requestId: string): Promise<void>
}

export type LogRow = { id: number; requestId: string; event: NotifyEvent; pickVersion: number; sentAt: string | null; attempts: number; lastError: string | null; updatedAt: string }

/** Durable record of every send attempt (template_pick_notify). */
export interface NotifyLog {
  wasSent(requestId: string, event: NotifyEvent, pickVersion: number): Promise<boolean>
  hasPicked(requestId: string): Promise<boolean>
  record(r: { requestId: string; event: NotifyEvent; pickVersion: number; ok: boolean; error?: string; at: Date }): Promise<void>
  listFailed(): Promise<LogRow[]>
  get(id: number): Promise<LogRow | null>
}

export type NotifyDeps = {
  now: () => Date | Promise<Date>
  bumpVersion: (requestId: string) => Promise<number>
  loadContext: (requestId: string) => Promise<RequestContext | null>
  lookupItem: (id: number) => Promise<ItemDetails | null>
  alarm: PickAlarm
  log: NotifyLog
  listCandidates: (type: string) => Promise<Candidate[]>
  listShortlist: (type: string) => Promise<ShortlistRow[]>
  saveSuggestions: (requestId: string, s: { version: number; at: string; suggestions: Suggestion[] }) => Promise<void>
  send: (m: OutMail) => Promise<SendResult>
  adminTo: () => string | null
  logError?: (msg: string) => void
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
const errMsg = (e: unknown) => (e instanceof Error ? e.message : String(e)).slice(0, 300)

/** Call after a pick is saved. Never throws (errors are logged). */
export async function onPickSaved(deps: NotifyDeps, requestId: string): Promise<void> {
  try {
    const now = await deps.now()
    const ctx = await deps.loadContext(requestId)
    if (!ctx || !ctx.choice) return
    const version = await deps.bumpVersion(requestId)
    if (ctx.choice === 'team_pick') {
      await deps.alarm.cancel(requestId)
      await sendEvent(deps, requestId, 'team_pick', version)
    } else if (isSelf(ctx.choice)) {
      if (await deps.log.hasPicked(requestId)) {
        await deps.alarm.reset(requestId, version, new Date(now.getTime() + CHANGE_DEBOUNCE_MS))
      } else {
        await sendEvent(deps, requestId, 'picked', version)
      }
    }
  } catch (e) {
    deps.logError?.(`[picker-notify] notify failed for ${requestId}: ${errMsg(e)}`)
  }
}

/** The alarm fired (DO alarm(), or the dev "fire alarm now"): ONE 'changed' email, latest state. */
export async function fireChangeAlarm(deps: NotifyDeps, requestId: string, pickVersion: number): Promise<SendOutcome> {
  return sendEvent(deps, requestId, 'changed', pickVersion)
}

/** Manual re-send of a failed log row (admin outbox page). Same idempotency key. */
export async function resendFailed(deps: NotifyDeps, logId: number): Promise<SendOutcome> {
  const row = await deps.log.get(logId)
  if (!row || row.sentAt) return 'skipped'
  return sendEvent(deps, row.requestId, row.event, row.pickVersion)
}

export type SendOutcome = 'sent' | 'failed' | 'skipped'

export async function sendEvent(deps: NotifyDeps, requestId: string, event: NotifyEvent, pickVersion: number): Promise<SendOutcome> {
  let now = new Date()
  try {
    now = await deps.now()
    if (await deps.log.wasSent(requestId, event, pickVersion)) return 'skipped'
    const to = deps.adminTo()
    if (!to) throw new Error('ADMIN_NOTIFY_EMAIL is not set')
    const email = await buildEmail(deps, requestId, event, pickVersion, now)
    if (!email) return 'skipped'
    const res = await deps.send({ ...email, to, idempotencyKey: idempotencyKey(requestId, event, pickVersion) })
    if (!res.ok) throw new Error(res.error)
    await deps.log.record({ requestId, event, pickVersion, ok: true, at: now })
    return 'sent'
  } catch (e) {
    const msg = errMsg(e)
    deps.logError?.(`[picker-notify] send failed ${requestId} ${event} v${pickVersion}: ${msg}`)
    try {
      await deps.log.record({ requestId, event, pickVersion, ok: false, error: msg, at: now })
    } catch (e2) {
      deps.logError?.(`[picker-notify] could not record failure: ${errMsg(e2)}`)
    }
    return 'failed'
  }
}

export async function buildEmail(deps: NotifyDeps, requestId: string, event: NotifyEvent, pickVersion: number, now: Date): Promise<Email | null> {
  const ctx = await deps.loadContext(requestId)
  if (!ctx) return null
  const closes = windowClosesAt(ctx)
  const pickedAt = ctx.pickedAt ? new Date(ctx.pickedAt) : now
  if (event === 'team_pick') {
    if (ctx.choice !== 'team_pick') return null
    const type = isNiche(ctx.businessType) ? ctx.businessType : 'other_local'
    const [cands, shortlist] = await Promise.all([deps.listCandidates(type), deps.listShortlist(type)])
    const suggestions = suggestTemplates(cands, { type, notes: ctx.notes, shortlist, now })
    await deps.saveSuggestions(requestId, { version: pickVersion, at: now.toISOString(), suggestions })
    return teamPickEmail({ requestId: ctx.id, businessName: ctx.businessName, businessType: ctx.businessType, pickedAt, windowClosesAt: closes, suggestions })
  }
  if (!isSelf(ctx.choice)) return null // moved to team_pick or cleared since; that path covers it
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
  return pickEmail(event === 'changed' ? 'changed' : 'picked', d)
}
