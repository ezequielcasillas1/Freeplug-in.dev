import { createHash, randomBytes } from 'node:crypto'
import type { SupabaseClient } from '@supabase/supabase-js'
import { issueMerchFontBundleToken } from './tokens'

export const MOCK_CHECKOUT_SESSION_PREFIX = 'mock_merch_cs_'

export function createMockCheckoutSessionId(): string {
  return `${MOCK_CHECKOUT_SESSION_PREFIX}${randomBytes(12).toString('hex')}`
}

export function isMockMerchCheckoutSessionId(sessionId: string): boolean {
  return sessionId.startsWith(MOCK_CHECKOUT_SESSION_PREFIX)
}

/** Demo flow when STRIPE_SECRET_KEY is missing and MERCH_MOCK_CHECKOUT=true. */
export async function ensureMockMerchToken(
  admin: SupabaseClient,
  sessionId: string,
  email?: string | null
): Promise<{ token: string; expiresAt: string } | null> {
  if (!isMockMerchCheckoutSessionId(sessionId)) return null
  const issued = await issueMerchFontBundleToken(admin, {
    stripeCheckoutSessionId: sessionId,
    stripePaymentIntentId: `mock_pi_${createHash('sha256').update(sessionId).digest('hex').slice(0, 24)}`,
    buyerEmail: email ?? 'buyer@example.com',
  })
  if ('error' in issued) {
    throw new Error(issued.error)
  }
  return { token: issued.token, expiresAt: issued.expiresAt }
}
