import { createHash, randomBytes } from 'node:crypto'
import type { SupabaseClient } from '@supabase/supabase-js'

export const MERCH_TOKEN_TTL_MS = 24 * 60 * 60 * 1000
export const MERCH_MAX_DOWNLOADS = 5

export type MerchTokenRow = {
  id: string
  token_hash: string
  stripe_checkout_session_id: string
  stripe_payment_intent_id: string | null
  buyer_email: string | null
  expires_at: string
  revoked_at: string | null
  max_downloads: number
  download_count: number
  created_at: string
  last_download_at: string | null
}

export function hashMerchToken(token: string): string {
  return createHash('sha256').update(token, 'utf8').digest('hex')
}

export function generateMerchToken(): string {
  return randomBytes(32).toString('base64url')
}

export function merchTokenExpiresAt(from = Date.now()): string {
  return new Date(from + MERCH_TOKEN_TTL_MS).toISOString()
}

export type IssueMerchTokenInput = {
  stripeCheckoutSessionId: string
  stripePaymentIntentId?: string | null
  buyerEmail?: string | null
}

/** Insert a row; returns the plaintext token once (store only the hash). */
export async function issueMerchFontBundleToken(
  admin: SupabaseClient,
  input: IssueMerchTokenInput
): Promise<{ token: string; expiresAt: string } | { error: string }> {
  const token = generateMerchToken()
  const tokenHash = hashMerchToken(token)
  const expiresAt = merchTokenExpiresAt()
  const { error } = await admin.from('merch_font_bundle_tokens').insert({
    token_hash: tokenHash,
    stripe_checkout_session_id: input.stripeCheckoutSessionId,
    stripe_payment_intent_id: input.stripePaymentIntentId ?? null,
    buyer_email: input.buyerEmail ?? null,
    expires_at: expiresAt,
    max_downloads: MERCH_MAX_DOWNLOADS,
  })
  if (error) {
    if (error.code === '23505') {
      const existing = await admin
        .from('merch_font_bundle_tokens')
        .select('expires_at')
        .eq('stripe_checkout_session_id', input.stripeCheckoutSessionId)
        .maybeSingle()
      if (existing.data?.expires_at) {
        return { error: 'token_already_issued' }
      }
    }
    return { error: error.message }
  }
  return { token, expiresAt }
}

export type MerchTokenValidation =
  | { ok: true; row: MerchTokenRow }
  | { ok: false; reason: 'not_found' | 'expired' | 'revoked' | 'limit' }

export async function validateMerchToken(
  admin: SupabaseClient,
  token: string
): Promise<MerchTokenValidation> {
  const tokenHash = hashMerchToken(token)
  const { data, error } = await admin
    .from('merch_font_bundle_tokens')
    .select('*')
    .eq('token_hash', tokenHash)
    .maybeSingle()
  if (error || !data) return { ok: false, reason: 'not_found' }
  const row = data as MerchTokenRow
  if (row.revoked_at) return { ok: false, reason: 'revoked' }
  if (new Date(row.expires_at).getTime() <= Date.now()) return { ok: false, reason: 'expired' }
  if (row.download_count >= row.max_downloads) return { ok: false, reason: 'limit' }
  return { ok: true, row }
}

export async function recordMerchDownload(
  admin: SupabaseClient,
  row: MerchTokenRow
): Promise<{ ok: true } | { ok: false; reason: 'limit' }> {
  if (row.download_count >= row.max_downloads) return { ok: false, reason: 'limit' }
  const { data, error } = await admin
    .from('merch_font_bundle_tokens')
    .update({
      download_count: row.download_count + 1,
      last_download_at: new Date().toISOString(),
    })
    .eq('id', row.id)
    .eq('download_count', row.download_count)
    .select('download_count')
    .maybeSingle()
  if (error || !data) return { ok: false, reason: 'limit' }
  return { ok: true }
}

export async function revokeMerchTokensByPaymentIntent(
  admin: SupabaseClient,
  paymentIntentId: string
): Promise<void> {
  await admin
    .from('merch_font_bundle_tokens')
    .update({ revoked_at: new Date().toISOString() })
    .eq('stripe_payment_intent_id', paymentIntentId)
    .is('revoked_at', null)
}

export async function revokeMerchTokensByChargeId(
  admin: SupabaseClient,
  stripe: { paymentIntents: { retrieve: (id: string) => Promise<{ id: string }> } },
  charge: { payment_intent?: string | { id: string } | null }
): Promise<void> {
  const pi = charge.payment_intent
  const piId = typeof pi === 'string' ? pi : pi?.id
  if (!piId) return
  await revokeMerchTokensByPaymentIntent(admin, piId)
}
