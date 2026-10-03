import 'server-only'
import { listEvents, recordEvent } from '@/lib/rate-limit/event-log'
import type { MailResult } from './mailer'

/**
 * Password-reset fallback bookkeeping (Aria, round 5). The reset is sent by us through Resend; when Resend
 * clearly did not accept it we fall back to Supabase Auth's own mailer (resetPasswordForEmail). Every
 * fallback logs a warning (reason only, never the address) and is counted for the admin mail banner.
 *
 * The count works on Workers (many isolates): each fallback inserts a row into public.rate_limit_hits via
 * src/lib/rate-limit/event-log.ts (bucket RESET_FALLBACK_BUCKET, key_hash = the reason label; the service
 * role has select/insert and rate_check() already purges rows older than 2 days), so no migration is needed. When the service role
 * is missing or the database is unreachable, an in-memory count for this isolate is used instead.
 */
export const RESET_FALLBACK_BUCKET = 'mail_reset_fallback'
export const RESET_FALLBACK_WINDOW_HOURS = 24
/** Wait at most this long for Resend on a reset before falling back (a late success may mean a duplicate: OK). */
export const RESET_SEND_TIMEOUT_MS = 8000

export type ResetFallbackReason =
  | 'missing_key'
  | 'missing_service_role'
  | 'missing_key+missing_service_role'
  | 'resend_http'
  | 'resend_network'
  | 'resend_timeout'
  | 'resend_local_error'

/** Fall back only when Resend clearly didn't accept the email. A returned id (success) never falls back. */
export function resetFallbackReason(res: MailResult): { reason: ResetFallbackReason; status: number | null } | null {
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
    case 'local_error':
      // Nothing reached Resend (e.g. the template failed to render), so a fallback can't duplicate.
      return { reason: 'resend_local_error', status: null }
  }
}

const memory = { events: [] as { at: number; reason: ResetFallbackReason }[] }

function windowStart(now: number): number {
  return now - RESET_FALLBACK_WINDOW_HOURS * 3600_000
}

/** Logs the warning and records one fallback. Never throws. */
export async function recordResetFallback(reason: ResetFallbackReason, status: number | null = null): Promise<void> {
  console.warn(
    `[password-reset] FALLBACK to Supabase Auth mailer (resetPasswordForEmail): reason=${reason}${status != null ? ` status=${status}` : ''}`
  )
  const now = Date.now()
  memory.events = memory.events.filter((e) => e.at >= windowStart(now)).slice(-999)
  memory.events.push({ at: now, reason })
  if (!process.env.SUPABASE_SERVICE_ROLE_KEY?.trim()) return
  const res = await recordEvent(RESET_FALLBACK_BUCKET, reason)
  if (!res.ok) console.error('[password-reset] could not record the fallback:', res.error)
}

export type ResetFallbackStatus = {
  /** Fallbacks in the last RESET_FALLBACK_WINDOW_HOURS hours. */
  count: number
  lastAt: string | null
  lastReason: ResetFallbackReason | null
  /** 'database' = all isolates; 'instance' = only this isolate (service role missing or DB unreachable). */
  source: 'database' | 'instance'
}

export async function getResetFallbackStatus(now: number = Date.now()): Promise<ResetFallbackStatus> {
  const since = windowStart(now)
  if (process.env.SUPABASE_SERVICE_ROLE_KEY?.trim()) {
    const rows = await listEvents(RESET_FALLBACK_BUCKET, new Date(since).toISOString())
    if (rows) {
      return {
        count: rows.length,
        lastAt: rows[0]?.at ?? null,
        lastReason: (rows[0]?.label as ResetFallbackReason | undefined) ?? null,
        source: 'database',
      }
    }
    // Database unreadable: fall through to the in-memory count.
  }
  const events = memory.events.filter((e) => e.at >= since)
  const last = events[events.length - 1]
  return {
    count: events.length,
    lastAt: last ? new Date(last.at).toISOString() : null,
    lastReason: last?.reason ?? null,
    source: 'instance',
  }
}

/** Tests only. */
export function __resetFallbackMemoryForTests(): void {
  memory.events = []
}
