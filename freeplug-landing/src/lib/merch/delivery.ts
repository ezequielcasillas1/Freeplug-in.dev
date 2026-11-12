import type { SupabaseClient } from '@supabase/supabase-js'
import { merchDownloadUrl, sendMerchDownloadEmail } from './email'
import {
  deriveMerchDownloadToken,
  issueMerchFontBundleToken,
  type IssueMerchTokenInput,
  type MerchTokenRow,
} from './tokens'

export type MerchDownloadReveal =
  | {
      state: 'ready'
      token: string
      downloadUrl: string
      expiresAt: string
      downloadCount: number
      maxDownloads: number
    }
  | { state: 'expired'; expiresAt: string }
  | { state: 'limit'; expiresAt: string; downloadCount: number; maxDownloads: number }
  | { state: 'revoked' }
  | { state: 'missing' }

export type EnsureMerchTokenInput = IssueMerchTokenInput

/** Insert token row if needed; always returns the deterministic download token when a row exists. */
export async function ensureMerchFontBundleToken(
  admin: SupabaseClient,
  input: EnsureMerchTokenInput
): Promise<{ token: string; expiresAt: string; created: boolean } | { error: string }> {
  const issued = await issueMerchFontBundleToken(admin, input)
  if ('error' in issued) return issued
  return issued
}

export function revealMerchDownload(row: MerchTokenRow): MerchDownloadReveal {
  if (row.revoked_at) return { state: 'revoked' }
  const token = deriveMerchDownloadToken(row.stripe_checkout_session_id)
  const expiresAt = row.expires_at
  if (new Date(expiresAt).getTime() <= Date.now()) {
    return { state: 'expired', expiresAt }
  }
  if (row.download_count >= row.max_downloads) {
    return {
      state: 'limit',
      expiresAt,
      downloadCount: row.download_count,
      maxDownloads: row.max_downloads,
    }
  }
  return {
    state: 'ready',
    token,
    downloadUrl: merchDownloadUrl(token),
    expiresAt,
    downloadCount: row.download_count,
    maxDownloads: row.max_downloads,
  }
}

export async function loadMerchTokenRow(
  admin: SupabaseClient,
  stripeCheckoutSessionId: string
): Promise<MerchTokenRow | null> {
  const { data, error } = await admin
    .from('merch_font_bundle_tokens')
    .select('*')
    .eq('stripe_checkout_session_id', stripeCheckoutSessionId)
    .maybeSingle()
  if (error || !data) return null
  return data as MerchTokenRow
}

export type MerchEmailSendOutcome = 'sent' | 'already_sent' | 'failed'

/** Send the download email at most once per checkout session; leave emailed_at null on failure for webhook retry. */
export async function trySendMerchDownloadEmailOnce(
  admin: SupabaseClient,
  stripeCheckoutSessionId: string,
  to: string,
  token: string,
  expiresAtIso: string
): Promise<MerchEmailSendOutcome> {
  const row = await loadMerchTokenRow(admin, stripeCheckoutSessionId)
  if (!row) return 'failed'
  if (row.emailed_at) return 'already_sent'

  const claimedAt = new Date().toISOString()
  const { data: claimed, error: claimError } = await admin
    .from('merch_font_bundle_tokens')
    .update({ emailed_at: claimedAt })
    .eq('stripe_checkout_session_id', stripeCheckoutSessionId)
    .is('emailed_at', null)
    .select('id')
    .maybeSingle()
  if (claimError) {
    console.error('[merch/delivery] claim emailed_at', claimError.message)
    return 'failed'
  }
  if (!claimed) return 'already_sent'

  try {
    await sendMerchDownloadEmail({
      to,
      downloadUrl: merchDownloadUrl(token),
      expiresAtIso,
    })
    return 'sent'
  } catch (e) {
    console.error('[merch/delivery] email', e instanceof Error ? e.message : e)
    await admin
      .from('merch_font_bundle_tokens')
      .update({ emailed_at: null })
      .eq('id', claimed.id)
    return 'failed'
  }
}

export type SessionTokenJson =
  | {
      status: 'paid'
      token: string
      downloadUrl: string
      expiresAt: string
      emailSent?: boolean
      emailPending?: boolean
      mock?: boolean
    }
  | {
      status: 'paid'
      unavailable: 'expired' | 'limit'
      expiresAt: string
      supportEmail: string
    }
  | { status: string }
  | { error: string }

const SUPPORT_EMAIL = 'support@freeplug-in.dev'

export async function buildMerchSessionTokenResponse(
  admin: SupabaseClient,
  stripeCheckoutSessionId: string,
  buyerEmail: string | null | undefined,
  opts?: { mock?: boolean }
): Promise<SessionTokenJson> {
  const row = await loadMerchTokenRow(admin, stripeCheckoutSessionId)
  if (!row) {
    return { error: 'No download available.' }
  }
  const reveal = revealMerchDownload(row)
  if (reveal.state === 'revoked') {
    return { error: 'Download revoked.' }
  }
  if (reveal.state === 'expired') {
    return {
      status: 'paid',
      unavailable: 'expired',
      expiresAt: reveal.expiresAt,
      supportEmail: SUPPORT_EMAIL,
    }
  }
  if (reveal.state === 'limit') {
    return {
      status: 'paid',
      unavailable: 'limit',
      expiresAt: reveal.expiresAt,
      supportEmail: SUPPORT_EMAIL,
    }
  }
  if (reveal.state !== 'ready') {
    return { error: 'No download available.' }
  }

  let emailSent = Boolean(row.emailed_at)
  let emailPending = false
  if (buyerEmail?.trim()) {
    const outcome = await trySendMerchDownloadEmailOnce(
      admin,
      stripeCheckoutSessionId,
      buyerEmail.trim(),
      reveal.token,
      reveal.expiresAt
    )
    if (outcome === 'sent') emailSent = true
    else if (outcome === 'failed' && !emailSent) emailPending = true
    else if (outcome === 'already_sent') emailSent = true
  }

  return {
    status: 'paid',
    token: reveal.token,
    downloadUrl: reveal.downloadUrl,
    expiresAt: reveal.expiresAt,
    ...(emailSent ? { emailSent: true } : {}),
    ...(emailPending ? { emailPending: true } : {}),
    ...(opts?.mock ? { mock: true } : {}),
  }
}
