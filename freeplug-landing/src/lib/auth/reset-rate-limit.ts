import 'server-only'
import { rateDecision, type RateRule } from '@/lib/rate-limit'
import { isTrustedClientIp } from '@/lib/rate-limit/client-ip'
import { isResetThrottledForEmail, isResetThrottledForIp } from './password-reset'

/**
 * Forgot-password rate limit (Aria, round 5): the shared DB-backed limiter (public.rate_check), so it holds
 * across Workers isolates. For the reset ONLY it fails OPEN: if the database errors (or the service role is
 * missing), the old in-memory per-isolate limit is used instead and a warning is logged. Every other
 * rateCheck() caller still fails closed.
 */
export const RESET_LIMITS = {
  /** One reset email per address per minute. */
  perEmail: { bucket: 'reset_email', limit: 1, windowSeconds: 60 } satisfies RateRule,
  /** At most 5 reset requests per trusted client IP per 10 minutes. */
  perIp: { bucket: 'reset_ip', limit: 5, windowSeconds: 600 } satisfies RateRule,
}

/** true = throttled (send nothing). Runs before any account lookup or send. Never logs the address. */
export async function isResetThrottled(email: string, ip: string): Promise<boolean> {
  const checks: { rule: RateRule; key: string; inMemory: () => boolean }[] = []
  // No per-IP throttle on the shared bucket (everyone without a trusted IP), only per email (Vera r2 N6).
  if (isTrustedClientIp(ip)) checks.push({ rule: RESET_LIMITS.perIp, key: ip, inMemory: () => isResetThrottledForIp(ip) })
  const normalized = email.trim().toLowerCase()
  checks.push({ rule: RESET_LIMITS.perEmail, key: normalized, inMemory: () => isResetThrottledForEmail(normalized) })

  for (const c of checks) {
    const d = await rateDecision(c.rule, c.key)
    if (d === 'limited') return true
    if (d === 'error') {
      console.warn(`[password-reset] rate limit database unavailable (${c.rule.bucket}); using the in-memory limit (fail open)`)
      if (c.inMemory()) return true
    }
  }
  return false
}
