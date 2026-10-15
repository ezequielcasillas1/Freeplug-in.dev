import 'server-only'
import { rateCheck, rateDecision, type RateRule } from '@/lib/rate-limit'
import { isTrustedClientIp } from '@/lib/rate-limit/client-ip'
import { hitLimit } from './password-reset'

/**
 * Forgot-password rate limits, on the shared DB-backed limiter (public.rate_check) so they hold across
 * Workers isolates.
 *
 * - Per address: 1/minute, 5/hour, 10/day. These use rateDecision() and fail OPEN: if the database errors
 *   (or the service role is missing) the same caps are enforced in memory per isolate and a warning is logged.
 * - Per trusted client IP: 20/hour via rateCheck(), which fails CLOSED like every other rateCheck() caller.
 *
 * The caller always shows the same neutral response, throttled or not, so none of this leaks whether an
 * account exists.
 */
export const RESET_LIMITS = {
  perEmailMinute: { bucket: 'reset_email', limit: 1, windowSeconds: 60 } satisfies RateRule,
  perEmailHour: { bucket: 'reset_email_hour', limit: 5, windowSeconds: 3600 } satisfies RateRule,
  perEmailDay: { bucket: 'reset_email_day', limit: 10, windowSeconds: 86_400 } satisfies RateRule,
  perIp: { bucket: 'reset_ip_hour', limit: 20, windowSeconds: 3600 } satisfies RateRule,
}

const EMAIL_RULES = [RESET_LIMITS.perEmailMinute, RESET_LIMITS.perEmailHour, RESET_LIMITS.perEmailDay]

/** true = throttled (send nothing). Runs before any account lookup or send. Never logs the address. */
export async function isResetThrottled(email: string, ip: string): Promise<boolean> {
  // No per-IP throttle on the shared bucket (everyone without a trusted IP), only per address (Vera r2 N6).
  if (isTrustedClientIp(ip) && !(await rateCheck(RESET_LIMITS.perIp, ip))) return true

  const normalized = email.trim().toLowerCase()
  for (const rule of EMAIL_RULES) {
    const d = await rateDecision(rule, normalized)
    if (d === 'limited') return true
    if (d === 'error') {
      console.warn(`[password-reset] rate limit database unavailable (${rule.bucket}); using the in-memory limit (fail open)`)
      if (hitLimit(`${rule.bucket}:${normalized}`, rule.limit, rule.windowSeconds * 1000)) return true
    }
  }
  return false
}
