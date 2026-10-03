import 'server-only'
import { listEvents, recordEvent } from '@/lib/rate-limit/event-log'
import { DEFAULT_EMAIL_LOCALE } from './locales'
import type { MailResult } from './mailer'

/**
 * Password-reset fallback bookkeeping (Aria, round 5). The reset is sent by us through Resend; when Resend
 * clearly did not accept it we fall back to Supabase Auth's own mailer (resetPasswordForEmail). Every
 * fallback is logged (reason only, never the address) and counted for the admin mail banner:
 *   - template errors (our template threw while rendering): console.error with template + locale, counted
 *     separately as "template errors";
 *   - everything else: console.warn, counted as "fallbacks".
 *
 * The count works on Workers (many isolates): each fallback inserts a row into public.rate_limit_hits via
 * src/lib/rate-limit/event-log.ts (bucket RESET_FALLBACK_BUCKET, key_hash = the label below; the service
 * role has select/insert and rate_check() already purges rows older than 2 days), so no migration is needed.
 * When the service role is missing or the database is unreachable, an in-memory count for this isolate is
 * used instead. Labels never contain personal data.
 */
export const RESET_FALLBACK_BUCKET = 'mail_reset_fallback'
export const RESET_FALLBACK_WINDOW_HOURS = 24
/** Wait at most this long for Resend on a reset before falling back (a late success may mean a duplicate: OK). */
export const RESET_SEND_TIMEOUT_MS = 8000
const TEMPLATE_ERROR = 'template_error'

export type ResetFallbackReason =
  | 'missing_key'
  | 'missing_service_role'
  | 'missing_key+missing_service_role'
  | 'resend_http'
  | 'resend_network'
  | 'resend_timeout'
  | 'resend_local_error'
  | 'template_error'

export type ResetFallback = {
  reason: ResetFallbackReason
  status: number | null
  /** Set for template_error. */
  template?: string
  locale?: string
}

/** Fall back only when Resend clearly didn't accept the email. A returned id (success) never falls back. */
export function resetFallbackReason(res: MailResult): ResetFallback | null {
  if (res.success) return null
  switch (res.reason) {
    case 'not_configured':
      return { reason: 'missing_key', status: null }
    case 'http':
      return { reason: 'resend_http', status: res.status ?? null }
    case 'network':
      return { reason: 'resend_network', status: null }
    case 'timeout':
      return { reason: 'resend_timeout', status: null }
    case 'template_error':
      // Nothing reached Resend (our template threw), so a fallback can't duplicate. Aria: keep it, loudly.
      return { reason: 'template_error', status: null, template: res.template ?? 'unknown', locale: res.locale ?? DEFAULT_EMAIL_LOCALE }
    case 'local_error':
      return { reason: 'resend_local_error', status: null }
  }
}

function labelFor(f: ResetFallback): string {
  return f.reason === 'template_error'
    ? `${TEMPLATE_ERROR}:${f.template ?? 'unknown'}:${f.locale ?? DEFAULT_EMAIL_LOCALE}`.slice(0, 128)
    : f.reason
}

const memory = { events: [] as { at: number; label: string }[] }

function windowStart(now: number): number {
  return now - RESET_FALLBACK_WINDOW_HOURS * 3600_000
}

/** Logs the fallback (ERROR for template errors, WARN otherwise) and records it. Never throws. */
export async function recordResetFallback(f: ResetFallback): Promise<void> {
  const what = `[password-reset] FALLBACK to Supabase Auth mailer (resetPasswordForEmail): reason=${f.reason}`
  if (f.reason === 'template_error') {
    console.error(`${what} template=${f.template ?? 'unknown'} locale=${f.locale ?? DEFAULT_EMAIL_LOCALE} (TEMPLATE ERROR: fix the template)`)
  } else {
    console.warn(`${what}${f.status != null ? ` status=${f.status}` : ''}`)
  }
  const now = Date.now()
  const label = labelFor(f)
  memory.events = memory.events.filter((e) => e.at >= windowStart(now)).slice(-999)
  memory.events.push({ at: now, label })
  if (!process.env.SUPABASE_SERVICE_ROLE_KEY?.trim()) return
  const res = await recordEvent(RESET_FALLBACK_BUCKET, label)
  if (!res.ok) console.error('[password-reset] could not record the fallback:', res.error)
}

export type ResetFallbackStatus = {
  /** Fallbacks other than template errors in the last RESET_FALLBACK_WINDOW_HOURS hours. */
  count: number
  lastAt: string | null
  lastReason: ResetFallbackReason | null
  /** Template errors (each also fell back) in the same window, counted separately. */
  templateErrors: number
  /** e.g. "password-reset/en" */
  lastTemplateError: string | null
  lastTemplateErrorAt: string | null
  /** 'database' = all isolates; 'instance' = only this isolate (service role missing or DB unreachable). */
  source: 'database' | 'instance'
}

function summarize(rows: { label: string; at: string }[], source: ResetFallbackStatus['source']): ResetFallbackStatus {
  // rows: newest first
  const tmpl = rows.filter((r) => r.label.startsWith(`${TEMPLATE_ERROR}:`) || r.label === TEMPLATE_ERROR)
  const other = rows.filter((r) => !tmpl.includes(r))
  const lastTmpl = tmpl[0]?.label.split(':')
  return {
    count: other.length,
    lastAt: other[0]?.at ?? null,
    lastReason: (other[0]?.label as ResetFallbackReason | undefined) ?? null,
    templateErrors: tmpl.length,
    lastTemplateError: lastTmpl ? `${lastTmpl[1] ?? 'unknown'}/${lastTmpl[2] ?? DEFAULT_EMAIL_LOCALE}` : null,
    lastTemplateErrorAt: tmpl[0]?.at ?? null,
    source,
  }
}

export async function getResetFallbackStatus(now: number = Date.now()): Promise<ResetFallbackStatus> {
  const since = windowStart(now)
  if (process.env.SUPABASE_SERVICE_ROLE_KEY?.trim()) {
    const rows = await listEvents(RESET_FALLBACK_BUCKET, new Date(since).toISOString())
    if (rows) return summarize(rows, 'database')
    // Database unreadable: fall through to the in-memory count.
  }
  const events = memory.events
    .filter((e) => e.at >= since)
    .map((e) => ({ label: e.label, at: new Date(e.at).toISOString() }))
    .reverse()
  return summarize(events, 'instance')
}

/** Tests only. */
export function __resetFallbackMemoryForTests(): void {
  memory.events = []
}
