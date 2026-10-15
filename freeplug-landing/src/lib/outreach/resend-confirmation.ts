import 'server-only'
import { headers } from 'next/headers'
import { createClient } from '@/lib/supabase/server'
import { rateCheck, type RateRule } from '@/lib/rate-limit'
import { SHARED_IP_BUCKET, clientIpFrom, isTrustedClientIp } from '@/lib/rate-limit/client-ip'
import { emailBaseUrl } from '@/lib/site'

/**
 * "Send it again" in the confirm-email box (round 7; Sable 2:08/2:10 AM, Jace, Vera). Re-sends the
 * Supabase sign-up confirmation email to the SIGNED-IN user's own address, for unconfirmed
 * accounts only. The address always comes from the verified session (auth.getUser()); nothing from
 * the request (body, query, link) is read.
 *
 * Rate limits (public.rate_check, like every other outreach limit; checked in this order). Numbers
 * confirmed by Jace (round 8):
 *   - per user: 1 per 60 seconds, and 5 per hour. This is also the per-ADDRESS limit: each account
 *     has exactly one email and the resend only ever goes to that account's own address, so no
 *     address can be sent more than the per-account limit allows;
 *   - per IP: 20 per hour for a trusted client IP (clientIpFrom); requests without a trusted IP
 *     share one bucket ('unknown-ip'), capped at 100 per hour in total.
 * Supabase's own resend / email limits (HTTP 429, or its over_*_rate_limit error codes) and the
 * limit store being down (rateCheck fails closed) also count as "limited". Every limited case shows
 * the same line (Sable 2:22 AM), since nothing may have been sent.
 *
 * Where it goes: supabase.auth.resend on the anon server client, i.e. NEXT_PUBLIC_SUPABASE_URL.
 * Locally (r7, tests) that is the local mock, which records the call and sends no mail.
 */
export const RESEND_LIMITS = {
  perUserMinute: { bucket: 'claim_resend_user_1m', limit: 1, windowSeconds: 60 },
  perUserHour: { bucket: 'claim_resend_user_1h', limit: 5, windowSeconds: 3600 },
  perIp: { bucket: 'claim_resend_ip', limit: 20, windowSeconds: 3600 },
  sharedIp: { bucket: 'claim_resend_shared_ip', limit: 100, windowSeconds: 3600 },
} as const satisfies Record<string, RateRule>

/** 'signed_out' is refused by the route; 'confirmed' sends nothing and the page moves on. */
export type ResendOutcome = 'sent' | 'limited' | 'error' | 'confirmed' | 'signed_out'

const SUPABASE_LIMIT_CODES = new Set(['over_email_send_rate_limit', 'over_request_rate_limit', 'over_sms_send_rate_limit'])

function isSupabaseRateLimit(error: { status?: number; code?: string }): boolean {
  return error.status === 429 || (!!error.code && SUPABASE_LIMIT_CODES.has(error.code))
}

export async function resendSignupConfirmation(): Promise<ResendOutcome> {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return 'signed_out'
  if (user.email_confirmed_at) return 'confirmed'
  const email = user.email?.trim()
  if (!email) return 'error'

  if (!(await rateCheck(RESEND_LIMITS.perUserMinute, user.id))) return 'limited'
  if (!(await rateCheck(RESEND_LIMITS.perUserHour, user.id))) return 'limited'
  const ip = clientIpFrom(await headers())
  const ipOk = isTrustedClientIp(ip)
    ? await rateCheck(RESEND_LIMITS.perIp, ip)
    : await rateCheck(RESEND_LIMITS.sharedIp, SHARED_IP_BUCKET)
  if (!ipOk) return 'limited'

  try {
    const { error } = await supabase.auth.resend({
      type: 'signup',
      email,
      options: { emailRedirectTo: `${emailBaseUrl()}/auth/callback?next=${encodeURIComponent('/claim')}` },
    })
    if (!error) return 'sent'
    if (isSupabaseRateLimit(error)) return 'limited'
    console.error('[claim resend]', error.message)
    return 'error'
  } catch (e) {
    console.error('[claim resend]', e instanceof Error ? e.message : e)
    return 'error'
  }
}
