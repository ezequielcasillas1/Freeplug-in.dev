import { createHash, createHmac, randomBytes } from 'node:crypto'
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
  emailed_at: string | null
}

/** Server-only signing material for deterministic per-session download tokens. */
export function merchTokenSigningSecret(env: Record<string, string | undefined> = process.env): string {
  const dedicated = env.MERCH_TOKEN_SECRET?.trim()
  if (dedicated) return dedicated
  const fallback = env.SUPABASE_SERVICE_ROLE_KEY?.trim()
  if (fallback) return fallback
  throw new Error('MERCH_TOKEN_SECRET or SUPABASE_SERVICE_ROLE_KEY is required for merch download tokens')
}

/** Stable download token for a paid checkout session (re-derivable without storing plaintext). */
export function deriveMerchDownloadToken(
  stripeCheckoutSessionId: string,
  env: Record<string, string | undefined> = process.env
): string {
  return createHmac('sha256', merchTokenSigningSecret(env))
    .update(stripeCheckoutSessionId, 'utf8')
    .digest('base64url')
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

export type IssueMerchTokenResult =
  | { token: string; expiresAt: string; created: boolean }
  | { error: string }

/** Insert a row if missing; store only the hash. Token is always re-derived for callers. */
export async function issueMerchFontBundleToken(
  admin: SupabaseClient,
  input: IssueMerchTokenInput
): Promise<IssueMerchTokenResult> {
  const token = deriveMerchDownloadToken(input.stripeCheckoutSessionId)
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
        return {
          token,
          expiresAt: existing.data.expires_at,
          created: false,
        }
      }
    }
    return { error: error.message }
  }
  return { token, expiresAt, created: true }
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
