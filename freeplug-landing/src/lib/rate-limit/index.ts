import 'server-only'
import { createHash } from 'node:crypto'
import { createAdminClient } from '@/lib/supabase/admin'

/**
 * Shared rate limiter (public.rate_check, SECURITY DEFINER, service role only). Used by the
 * outreach preview (token lookups, forms, photos) and the dashboard help chat. Keys are hashed
 * before they reach the database. Fails closed: a database error counts as "over the limit".
 */
export type RateRule = { bucket: string; limit: number; windowSeconds: number }

export function hashRateKey(raw: string): string {
  return createHash('sha256').update(`fp-rate:v1:${raw}`).digest('hex')
}

export async function rateCheck(rule: RateRule, rawKey: string): Promise<boolean> {
  try {
    const { data, error } = await createAdminClient().rpc('rate_check', {
      p_bucket: rule.bucket,
      p_key: hashRateKey(rawKey),
      p_limit: rule.limit,
      p_window_seconds: rule.windowSeconds,
    })
    if (error) {
      console.error('[rate_check]', error.message)
      return false
    }
    return data === true
  } catch (e) {
    console.error('[rate_check]', e instanceof Error ? e.message : e)
    return false
  }
}

/** Dashboard help chat "Send request": 10 per hour per user. */
export const HELP_CHAT_LIMIT: RateRule = { bucket: 'help_chat_user', limit: 10, windowSeconds: 3600 }
