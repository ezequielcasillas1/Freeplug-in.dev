import 'server-only'
import { parseTipDollars } from '@/lib/plans/tips'
import { checkoutSessionExpiresAt } from '@/lib/stripe/checkout-expiry'
import type Stripe from 'stripe'
import { cookies, headers } from 'next/headers'
import { createAdminClient } from '@/lib/supabase/admin'
import { HELP_CHAT_LIMIT, hashRateKey, rateCheck } from '@/lib/rate-limit'
import { clientIpFrom } from '@/lib/rate-limit/client-ip'
import { assertAdminAccess } from '@/lib/admin/guard'
import { emailBaseUrl } from '@/lib/site'
import { appBaseUrl } from '@/lib/stripe/config'
import { getStripe } from '@/lib/stripe/server'
import { listLiveSubscriptions } from '@/lib/stripe/active-subscription'
import { createCheckoutCustomer, findCustomersToCheck } from '@/lib/stripe/checkout-customer'
import { localeKeyPart, stripeLocaleParam } from '@/lib/stripe/locale'
import { readProfileLocale } from '@/i18n/profile-locale'
import {
  completeSetupSession,
  markLiveFromPaidInvoice,
  publishOutreachSite,
  type OutreachBillingSite,
  type OutreachBillingStore,
  type OutreachSitePatch,
} from './billing'
import {
  FORM_PASS_COOKIE_NAME,
  FORM_PASS_MAX_AGE_SECONDS,
  PREVIEW_COOKIE_MAX_AGE_SECONDS,
  PREVIEW_COOKIE_NAME,
  outreachCookieSecret,
  signSiteCookie,
  siteCookieOptions,
  verifySiteCookie,
} from './cookie'
import { processUploadedImage, randomObjectName, type ProcessedImage } from './image'
import { ADMIN_REJECT_ALREADY_APPLIED } from './admin-labels'
import { PHOTO_LIMITS } from './limits'
import { resolveOutreachStep } from './plan'
import {
  adminCreateSiteSchema,
  changeRequestSchema,
  detailsSubmissionSchema,
  planChoiceSchema,
  readPrefill,
  readServiceSources,
  type PrefillMap,
  type ServiceItem,
} from './schemas'
import { extendedExpiry, generatePreviewToken, hashPreviewToken, isLinkUsable, isWellFormedToken, linkExpiryFrom } from './token'
import { verifyTurnstile } from './turnstile'

/**
 * THE service-role module for the outreach flow (Aria, section 4). Rules:
 *   * Preview functions derive the site from the preview cookie (set by /p/<token> after the
 *     token check) and re-check it in the database; they never take a site id, user id or status
 *     from the client, and they only INSERT into the pending tables.
 *   * Customer functions take the verified session user and find "their" site by claimed_by.
 *   * Admin functions call assertAdminAccess() themselves as well.
 * ESLint only lets this file (plus existing server code) import @/lib/supabase/admin.
 */

export const OUTREACH_BUCKET = 'outreach'
const SIGNED_URL_SECONDS = 300

/** Rate limits (Aria, sections 3 and 4). */
export const LIMITS = {
  tokenLookupPerIp: { bucket: 'outreach_token_ip', limit: 30, windowSeconds: 600 },
  formPerSite: { bucket: 'outreach_form_site', limit: 5, windowSeconds: 3600 },
  formPerIp: { bucket: 'outreach_form_ip', limit: 20, windowSeconds: 86_400 },
  // 50 photos per submission plus retries fit in one session; still capped (Ezequiel, 12:04 AM).
  photoPerSite: { bucket: 'outreach_photo_site', limit: 150, windowSeconds: 3600 },
  photoPerIp: { bucket: 'outreach_photo_ip', limit: 200, windowSeconds: 3600 },
  customerPhotoPerUser: { bucket: 'customer_photo_user', limit: 150, windowSeconds: 3600 },
  helpChatPerUser: HELP_CHAT_LIMIT,
} as const

type Result<T = object> = ({ ok: true } & T) | { ok: false; error: string; code?: string }

function db() {
  return createAdminClient()
}

// ----------------------------------------------------------------------------- infrastructure

/** Trusted client IP (see clientIpFrom: CF-Connecting-IP only with TRUST_CF_CONNECTING_IP=true; never X-Forwarded-For). */
export async function requestIp(): Promise<string> {
  return clientIpFrom(await headers())
}

export { hashRateKey, rateCheck }

// ----------------------------------------------------------------------------- site lookups

const SITE_COLUMNS =
  'id, business_name, contact_email, expires_at, revoked_at, declined_at, claimed_by, claimed_at, screenshot_desktop_path, screenshot_mobile_path, prefill, services, service_sources, plan_step, plan_tip_dollars, plan_hosting_cents, plan_addon_tier, setup_session_id, setup_completed_at, stripe_customer_id, stripe_payment_method_id, stripe_subscription_id, publish_status, publish_error, publish_attempts, published_at, live_url, claimer_verified_at, created_at'

export type OutreachSiteRow = OutreachBillingSite & {
  contact_email: string | null
  expires_at: string
  revoked_at: string | null
  declined_at: string | null
  claimed_at: string | null
  screenshot_desktop_path: string | null
  screenshot_mobile_path: string | null
  prefill: unknown
  services: string[]
  service_sources: unknown
  publish_error: string | null
  published_at: string | null
  claimer_verified_at: string | null
  created_at: string
}

async function siteById(id: string): Promise<OutreachSiteRow | null> {
  const { data } = await db().from('outreach_sites').select(SITE_COLUMNS).eq('id', id).maybeSingle()
  return (data as OutreachSiteRow | null) ?? null
}

/** Exact-hash lookup; null for unknown, expired, revoked and claimed alike. */
export async function findUsableSiteByToken(token: string): Promise<OutreachSiteRow | null> {
  if (!isWellFormedToken(token)) return null
  const { data } = await db()
    .from('outreach_sites')
    .select(SITE_COLUMNS)
    .eq('token_hash', hashPreviewToken(token))
    .maybeSingle()
  const site = (data as OutreachSiteRow | null) ?? null
  return isLinkUsable(site) ? site : null
}

/**
 * /p/<token> and /claim/<token>: checks the token and swaps it for the signed preview cookie.
 * Invalid tokens clear the cookie; the caller redirects the same way in both cases.
 */
export async function enterPreviewWithToken(token: string): Promise<boolean> {
  const jar = await cookies()
  const allowed = await rateCheck(LIMITS.tokenLookupPerIp, await requestIp())
  const site = allowed ? await findUsableSiteByToken(token) : null
  const secret = outreachCookieSecret('preview')
  if (!site || !secret) {
    jar.set(PREVIEW_COOKIE_NAME, '', { ...siteCookieOptions(0), maxAge: 0 })
    return false
  }
  jar.set(
    PREVIEW_COOKIE_NAME,
    signSiteCookie(site.id, secret, PREVIEW_COOKIE_MAX_AGE_SECONDS),
    siteCookieOptions(PREVIEW_COOKIE_MAX_AGE_SECONDS)
  )
  return true
}

/** The preview site from the signed cookie, re-checked in the database (null = 404). */
export async function currentPreviewSite(): Promise<OutreachSiteRow | null> {
  const jar = await cookies()
  const siteId = verifySiteCookie(jar.get(PREVIEW_COOKIE_NAME)?.value, outreachCookieSecret('preview'))
  if (!siteId) return null
  const site = await siteById(siteId)
  return isLinkUsable(site) ? site : null
}

async function signedUrl(path: string | null): Promise<string | null> {
  if (!path) return null
  const { data, error } = await db().storage.from(OUTREACH_BUCKET).createSignedUrl(path, SIGNED_URL_SECONDS)
  if (error) {
    console.error('[outreach] signed url', error.message)
    return null
  }
  return data?.signedUrl ?? null
}

export type ScreenshotUrls = { desktop: string | null; mobile: string | null }

export async function screenshotUrlsFor(site: Pick<OutreachSiteRow, 'screenshot_desktop_path' | 'screenshot_mobile_path'>): Promise<ScreenshotUrls> {
  const [desktop, mobile] = await Promise.all([
    signedUrl(site.screenshot_desktop_path),
    signedUrl(site.screenshot_mobile_path),
  ])
  return { desktop, mobile }
}

export type PreviewPageData = {
  businessName: string
  expiresAt: string
  declined: boolean
  prefill: PrefillMap
  services: ServiceItem[]
  screenshots: ScreenshotUrls
  photosUsed: number
}

export async function getPreviewPageData(): Promise<PreviewPageData | null> {
  const site = await currentPreviewSite()
  if (!site) return null
  return {
    businessName: site.business_name,
    expiresAt: site.expires_at,
    declined: Boolean(site.declined_at),
    prefill: readPrefill(site.prefill),
    services: readServiceSources(site.services, site.service_sources),
    screenshots: await screenshotUrlsFor(site),
    photosUsed: await photosUsed({ outreachSiteId: site.id, userId: null, source: 'preview' }),
  }
}

// ----------------------------------------------------------------------------- preview writes

async function formAllowed(siteId: string): Promise<boolean> {
  const ip = await requestIp()
  return (await rateCheck(LIMITS.formPerSite, siteId)) && (await rateCheck(LIMITS.formPerIp, ip))
}

async function passSubmissionId(): Promise<string | null> {
  const jar = await cookies()
  return verifySiteCookie(jar.get(FORM_PASS_COOKIE_NAME)?.value, outreachCookieSecret('pass'))
}

type SubmissionRow = { id: string; outreach_site_id: string; source: string; submitted_by: string | null; review_status: string }

async function pendingSubmission(id: string | null): Promise<SubmissionRow | null> {
  if (!id || !/^[0-9a-f-]{36}$/.test(id)) return null
  const { data } = await db()
    .from('site_details_submissions')
    .select('id, outreach_site_id, source, submitted_by, review_status')
    .eq('id', id)
    .maybeSingle()
  const row = (data as SubmissionRow | null) ?? null
  return row && row.review_status === 'pending' ? row : null
}

type PhotoOwner = {
  outreachSiteId: string | null
  submissionId: string | null
  userId: string | null
  source: 'preview' | 'customer'
}

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

async function existingPhotoId(owner: PhotoOwner, clientPhotoId: string): Promise<string | null> {
  let q = db().from('site_photos').select('id').eq('client_photo_id', clientPhotoId)
  q = owner.outreachSiteId ? q.eq('outreach_site_id', owner.outreachSiteId) : q.is('outreach_site_id', null).eq('user_id', owner.userId!)
  const { data } = await q.maybeSingle()
  return (data?.id as string | undefined) ?? null
}

/**
 * Stores one photo. `clientPhotoId` is the browser's idempotency key for that photo: a retry of
 * a photo that already arrived returns the stored row instead of adding (and counting) another.
 * The database enforces the caps (site_photos_enforce_cap, same numbers as PHOTO_LIMITS): the
 * preview link's lifetime cap, a claimed customer's per-request cap, an organic account's cap.
 */
/** Size and content checks (re-encoded JPEG). No storage or database writes. */
async function checkPhoto(file: unknown): Promise<{ ok: true; image: ProcessedImage } | { ok: false; error: string; code: string }> {
  if (!(file instanceof Blob)) return { ok: false, error: 'bad_type', code: 'bad_type' }
  if (file.size > PHOTO_LIMITS.maxUploadBytes) return { ok: false, error: 'too_large', code: 'too_large' }
  const checked = await processUploadedImage(new Uint8Array(await file.arrayBuffer()), 'photo')
  if (!checked.ok) return { ok: false, error: checked.reason, code: checked.reason }
  return { ok: true, image: checked.image }
}

async function storePhoto(owner: PhotoOwner, clientPhotoId: unknown, file: unknown): Promise<Result<{ photoId: string }>> {
  if (typeof clientPhotoId !== 'string' || !UUID_RE.test(clientPhotoId)) return { ok: false, error: 'invalid', code: 'invalid' }
  if (!(file instanceof Blob)) return { ok: false, error: 'bad_type', code: 'bad_type' }
  const already = await existingPhotoId(owner, clientPhotoId)
  if (already) return { ok: true, photoId: already }
  const checked = await checkPhoto(file)
  if (!checked.ok) return checked
  return storeProcessedImage(owner, clientPhotoId, checked.image)
}

async function storeProcessedImage(owner: PhotoOwner, clientPhotoId: string, image: ProcessedImage): Promise<Result<{ photoId: string }>> {
  const checked = { image }
  const folder = owner.outreachSiteId ? `outreach/${owner.outreachSiteId}` : `users/${owner.userId}`
  const path = `${folder}/photos/${randomObjectName()}.jpg`
  const client = db()
  const up = await client.storage.from(OUTREACH_BUCKET).upload(path, checked.image.data, {
    contentType: 'image/jpeg',
    upsert: false,
  })
  if (up.error) {
    console.error('[outreach] photo upload', up.error.message)
    return { ok: false, error: 'upload', code: 'upload' }
  }
  const { data, error } = await client
    .from('site_photos')
    .insert({
      outreach_site_id: owner.outreachSiteId,
      submission_id: owner.submissionId,
      user_id: owner.userId,
      source: owner.source,
      client_photo_id: clientPhotoId,
      storage_path: path,
      bytes: checked.image.bytes,
      width: checked.image.width,
      height: checked.image.height,
    })
    .select('id')
    .single()
  if (error || !data) {
    await client.storage.from(OUTREACH_BUCKET).remove([path])
    if ((error as { code?: string } | null)?.code === '23505') {
      // Two tries of the same photo raced; the other one won. Same photo, counted once.
      const winner = await existingPhotoId(owner, clientPhotoId)
      if (winner) return { ok: true, photoId: winner }
    }
    const text = `${error?.message ?? ''} ${(error as { hint?: string } | null)?.hint ?? ''}`
    const code = text.includes('photo_limit') || text.includes('Photo limit') ? 'photo_limit' : text.includes('submission_closed') ? 'expired' : 'upload'
    return { ok: false, error: code, code }
  }
  return { ok: true, photoId: data.id as string }
}

/** Photos already sent from this link (all sends) or by an organic customer; for the "{n} of 50" count. */
async function photosUsed(owner: { outreachSiteId: string | null; userId: string | null; source: 'preview' | 'customer' }): Promise<number> {
  let q = db().from('site_photos').select('id', { count: 'exact', head: true }).eq('source', owner.source)
  q = owner.outreachSiteId ? q.eq('outreach_site_id', owner.outreachSiteId) : q.is('outreach_site_id', null).eq('user_id', owner.userId!)
  const { count } = await q
  return count ?? 0
}

/**
 * Starting count for the dashboard photo box. Claimed outreach customers: 0, because their cap is
 * per upload request (PHOTO_LIMITS.maxPerCustomerRequest, no lifetime cap; Jace, Sep 27) and each
 * visit to the page is a new request. Organic customers keep their lifetime count.
 */
export async function customerPhotosUsed(userId: string): Promise<number> {
  const site = await getClaimedSiteForUser(userId)
  if (site) return 0
  return photosUsed({ outreachSiteId: null, userId, source: 'customer' })
}

/**
 * Claim step 2: the photos sent from the preview carry over (Lina, Sep 27). Short-lived signed
 * links for the claimer only; rejected photos and ones whose stored copy was deleted are skipped.
 */
export async function customerPreviewPhotos(userId: string): Promise<{ id: string; url: string }[]> {
  const site = await getClaimedSiteForUser(userId)
  if (!site) return []
  const client = db()
  const { data } = await client
    .from('site_photos')
    .select('id, storage_path')
    .eq('outreach_site_id', site.id)
    .eq('source', 'preview')
    .neq('review_status', 'rejected')
    .is('file_deleted_at', null)
    .order('created_at')
    .limit(PHOTO_LIMITS.maxPerLink)
  const rows = (data ?? []) as { id: string; storage_path: string }[]
  if (rows.length === 0) return []
  const signed = await client.storage.from(OUTREACH_BUCKET).createSignedUrls(rows.map((r) => r.storage_path), SIGNED_URL_SECONDS)
  const out: { id: string; url: string }[] = []
  ;(signed.data ?? []).forEach((x, i) => {
    if (x?.signedUrl && rows[i]) out.push({ id: rows[i].id, url: x.signedUrl })
  })
  return out
}

/**
 * "Send my details": Turnstile + rate limits, then one append-only submission row (source
 * 'preview'). Returns its id and sets a 30-minute pass so the photos upload one by one after it
 * (up to 50, three at a time, each retryable) without sending the form again.
 */
export async function submitPreviewDetails(input: unknown, turnstileToken: string | null): Promise<Result<{ submissionId: string }>> {
  const site = await currentPreviewSite()
  if (!site) return { ok: false, error: 'expired', code: 'expired' }
  const parsed = detailsSubmissionSchema.safeParse(input)
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0]?.message ?? 'invalid', code: 'invalid' }
  if (!(await verifyTurnstile(turnstileToken, await requestIp()))) {
    return { ok: false, error: 'turnstile', code: 'turnstile' }
  }
  if (!(await formAllowed(site.id))) return { ok: false, error: 'rate', code: 'rate' }
  const secret = outreachCookieSecret('pass')
  if (!secret) return { ok: false, error: 'config', code: 'config' }
  const { data, error } = await db()
    .from('site_details_submissions')
    .insert({
      outreach_site_id: site.id,
      source: 'preview',
      fields: sentFields(parsed.data.fields),
      services: parsed.data.services,
    })
    .select('id')
    .single()
  if (error || !data) return { ok: false, error: 'save', code: 'save' }
  const submissionId = data.id as string
  const jar = await cookies()
  jar.set(FORM_PASS_COOKIE_NAME, signSiteCookie(submissionId, secret, FORM_PASS_MAX_AGE_SECONDS), siteCookieOptions(FORM_PASS_MAX_AGE_SECONDS))
  return { ok: true, submissionId }
}

/** One photo for the submission in the pass cookie (the 51st from the link is refused). */
export async function uploadPreviewPhoto(clientPhotoId: unknown, file: unknown): Promise<Result<{ photoId: string }>> {
  const site = await currentPreviewSite()
  if (!site) return { ok: false, error: 'expired', code: 'expired' }
  const sub = await pendingSubmission(await passSubmissionId())
  if (!sub || sub.outreach_site_id !== site.id || sub.source !== 'preview') return { ok: false, error: 'expired', code: 'expired' }
  if (!(await rateCheck(LIMITS.photoPerSite, site.id)) || !(await rateCheck(LIMITS.photoPerIp, await requestIp()))) {
    return { ok: false, error: 'rate', code: 'rate' }
  }
  return storePhoto({ outreachSiteId: site.id, submissionId: sub.id, userId: null, source: 'preview' }, clientPhotoId, file)
}

export async function submitPreviewChangeRequest(input: unknown, turnstileToken: string | null): Promise<Result> {
  const site = await currentPreviewSite()
  if (!site) return { ok: false, error: 'expired', code: 'expired' }
  const parsed = changeRequestSchema.safeParse(input)
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0]?.message ?? 'invalid', code: 'invalid' }
  if (!(await verifyTurnstile(turnstileToken, await requestIp()))) {
    return { ok: false, error: 'turnstile', code: 'turnstile' }
  }
  if (!(await formAllowed(site.id))) return { ok: false, error: 'rate', code: 'rate' }
  const { error } = await db().from('outreach_change_requests').insert({
    outreach_site_id: site.id,
    source: 'preview',
    change_type: parsed.data.changeType,
    description: parsed.data.description,
  })
  if (error) return { ok: false, error: 'save', code: 'save' }
  return { ok: true }
}

/** "Not right now": one append-only event; a trigger stamps declined_at on the site. */
export async function declinePreview(): Promise<Result<{ expiresAt: string }>> {
  const site = await currentPreviewSite()
  if (!site) return { ok: false, error: 'expired', code: 'expired' }
  if (!site.declined_at) {
    if (!(await formAllowed(site.id))) return { ok: false, error: 'rate', code: 'rate' }
    const { error } = await db().from('outreach_site_events').insert({ outreach_site_id: site.id, kind: 'declined' })
    if (error) return { ok: false, error: 'save', code: 'save' }
  }
  return { ok: true, expiresAt: site.expires_at }
}

// ----------------------------------------------------------------------------- customer (claimed)

export async function getClaimedSiteForUser(userId: string): Promise<OutreachSiteRow | null> {
  const { data } = await db()
    .from('outreach_sites')
    .select(SITE_COLUMNS)
    .eq('claimed_by', userId)
    .order('claimed_at', { ascending: false })
    .limit(1)
    .maybeSingle()
  return (data as OutreachSiteRow | null) ?? null
}

export type ClaimOutcome =
  | { ok: true; site: OutreachSiteRow }
  | { ok: false; reason: 'no_link' | 'email_unconfirmed' | 'claimed_by_other' | 'link_invalid' | 'error' }

/**
 * Claims the site in the preview cookie for the signed-in user (Vera rule 6): requires a confirmed
 * email, binds through the service-role RPC to the verified user id (never by matching email),
 * single use and idempotent.
 */
export async function claimPreviewSiteForUser(user: {
  id: string
  email_confirmed_at?: string | null
}): Promise<ClaimOutcome> {
  const existing = await getClaimedSiteForUser(user.id)
  if (existing) return { ok: true, site: existing }
  const site = await currentPreviewSite()
  if (!site) return { ok: false, reason: 'no_link' }
  if (!user.email_confirmed_at) return { ok: false, reason: 'email_unconfirmed' }
  const { data: claimedRows, error } = await db().rpc('claim_outreach_site', { p_site_id: site.id, p_user_id: user.id })
  if (error) {
    const hint = (error as { hint?: string }).hint
    if (hint === 'email_unconfirmed' || hint === 'claimed_by_other' || hint === 'link_invalid') {
      return { ok: false, reason: hint }
    }
    console.error('[outreach] claim', error.message)
    return { ok: false, reason: 'error' }
  }
  // Read the claimed row back by the id the RPC returned, with a query that differs from every
  // lookup made before the claim (Next memoizes identical GETs within one render; re-running
  // getClaimedSiteForUser here returned the stale "not claimed" answer: Vera QA #1).
  const siteId = (Array.isArray(claimedRows) ? (claimedRows[0] as { site_id?: string } | undefined)?.site_id : null) ?? site.id
  const { data } = await db()
    .from('outreach_sites')
    .select(SITE_COLUMNS)
    .eq('id', siteId)
    .eq('claimed_by', user.id)
    .maybeSingle()
  const claimed = (data as OutreachSiteRow | null) ?? null
  return claimed ? { ok: true, site: claimed } : { ok: false, reason: 'error' }
}

export async function getSiteDetails(siteId: string): Promise<{ fields: Record<string, string>; services: string[]; customer_confirmed_at: string | null } | null> {
  const { data } = await db()
    .from('site_details')
    .select('fields, services, customer_confirmed_at')
    .eq('outreach_site_id', siteId)
    .maybeSingle()
  return (data as { fields: Record<string, string>; services: string[]; customer_confirmed_at: string | null } | null) ?? null
}

/** Latest preview submission (claim step 2 starts from what was sent from the preview). */
export async function latestPreviewSubmission(siteId: string): Promise<{ fields: Record<string, string>; services: { name: string; keep: boolean }[] } | null> {
  const { data } = await db()
    .from('site_details_submissions')
    .select('fields, services')
    .eq('outreach_site_id', siteId)
    .eq('source', 'preview')
    .order('submitted_at', { ascending: false })
    .limit(1)
    .maybeSingle()
  return (data as { fields: Record<string, string>; services: { name: string; keep: boolean }[] } | null) ?? null
}

/** Only the fields that were sent with a value (the form leaves out untouched pre-fills). */
function sentFields(f: Record<string, string>): Record<string, string> {
  return Object.fromEntries(Object.entries(f).filter(([, v]) => typeof v === 'string' && v !== ''))
}

/**
 * Claim step 2: the customer's details submission plus the confirmed time (rule 7), in one
 * database transaction (confirm_customer_details). The preview photos still waiting for review are
 * carried into this submission, so the admin approves them on the customer's row (round 3: they
 * used to stay on the stale preview rows, which can't be applied).
 * Round 9 (Jace): at most one pending customer details row per site. Confirming again updates that
 * row in place (same id, photos stay with it); a reviewed row is never touched, the next confirm
 * starts a new one. If two confirms race and the database reports the unique index (23505), the
 * call is retried once, which updates the row that won.
 */
export async function confirmCustomerDetails(userId: string, input: unknown): Promise<Result<{ submissionId: string }>> {
  const site = await getClaimedSiteForUser(userId)
  if (!site) return { ok: false, error: 'no_site', code: 'no_site' }
  const parsed = detailsSubmissionSchema.safeParse(input)
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0]?.message ?? 'invalid', code: 'invalid' }
  const f = parsed.data.fields
  if (!f.phone || !f.hours || !f.service_area || !f.quote_email) {
    return { ok: false, error: 'incomplete', code: 'incomplete' }
  }
  const args = { p_site_id: site.id, p_user_id: userId, p_fields: sentFields(f), p_services: parsed.data.services }
  let { data, error } = await db().rpc('confirm_customer_details', args)
  if (error && (error as { code?: string }).code === '23505') {
    ;({ data, error } = await db().rpc('confirm_customer_details', args))
  }
  if (error || typeof data !== 'string') return { ok: false, error: 'save', code: 'save' }
  return { ok: true, submissionId: data }
}

/**
 * Dashboard "Upload photos", first photo of a batch: claimed outreach customers get a photos-only
 * pending submission (empty fields, no services) that admin reviews like any other; organic
 * customers' photos belong to the user (submissionId null). The submission is created only once
 * a photo passed the checks, so a refused batch leaves no empty row (Vera QA #8); the rest of
 * the batch then uploads to the returned submissionId. A retry of the same photo (same client
 * id) returns the same submission instead of opening another.
 */
export async function startCustomerPhotoBatch(
  userId: string,
  clientPhotoId: unknown,
  file: unknown
): Promise<Result<{ submissionId: string | null; photoId: string }>> {
  if (!(await rateCheck(LIMITS.customerPhotoPerUser, userId))) return { ok: false, error: 'rate', code: 'rate' }
  if (typeof clientPhotoId !== 'string' || !UUID_RE.test(clientPhotoId)) return { ok: false, error: 'invalid', code: 'invalid' }
  const site = await getClaimedSiteForUser(userId)
  if (!site) {
    const res = await storePhoto({ outreachSiteId: null, submissionId: null, userId, source: 'customer' }, clientPhotoId, file)
    return res.ok ? { ok: true, submissionId: null, photoId: res.photoId } : res
  }
  const client = db()
  const { data: prior } = await client
    .from('site_photos')
    .select('id, submission_id')
    .eq('outreach_site_id', site.id)
    .eq('client_photo_id', clientPhotoId)
    .maybeSingle()
  if (prior?.id) return { ok: true, submissionId: (prior.submission_id as string | null) ?? null, photoId: prior.id as string }
  const checked = await checkPhoto(file)
  if (!checked.ok) return checked
  const { data, error } = await client
    .from('site_details_submissions')
    .insert({ outreach_site_id: site.id, source: 'customer', submitted_by: userId, fields: {}, services: [] })
    .select('id')
    .single()
  if (error || !data) return { ok: false, error: 'save', code: 'save' }
  const submissionId = data.id as string
  const stored = await storeProcessedImage({ outreachSiteId: site.id, submissionId, userId, source: 'customer' }, clientPhotoId, checked.image)
  if (!stored.ok) {
    // Submissions are append-only; close the empty one so it never shows up for review.
    await client
      .from('site_details_submissions')
      .update({ review_status: 'rejected', reviewed_at: new Date().toISOString() })
      .eq('id', submissionId)
      .eq('review_status', 'pending')
    return stored
  }
  return { ok: true, submissionId, photoId: stored.photoId }
}

export async function uploadCustomerPhoto(
  userId: string,
  submissionId: string | null,
  clientPhotoId: unknown,
  file: unknown
): Promise<Result<{ photoId: string }>> {
  if (!(await rateCheck(LIMITS.customerPhotoPerUser, userId))) return { ok: false, error: 'rate', code: 'rate' }
  const site = await getClaimedSiteForUser(userId)
  if (!site) return storePhoto({ outreachSiteId: null, submissionId: null, userId, source: 'customer' }, clientPhotoId, file)
  const sub = await pendingSubmission(submissionId)
  if (!sub || sub.outreach_site_id !== site.id || sub.source !== 'customer' || sub.submitted_by !== userId) {
    return { ok: false, error: 'expired', code: 'expired' }
  }
  return storePhoto({ outreachSiteId: site.id, submissionId: sub.id, userId, source: 'customer' }, clientPhotoId, file)
}

export async function saveChosenPlan(userId: string, input: unknown): Promise<Result> {
  const site = await getClaimedSiteForUser(userId)
  if (!site) return { ok: false, error: 'no_site', code: 'no_site' }
  // Locked once live, or once a card is saved for a sellable ladder step. A site that saved a card
  // with a pre-ladder (slider/add-on) choice has no plan_step yet, and a site whose saved step is no
  // longer sold (ladder.ts sellable=false) can't be published, so its customer may pick again.
  const savedStep = resolveOutreachStep(site.plan_step)
  if (site.publish_status === 'live' || (site.setup_completed_at && savedStep?.sellable)) {
    return { ok: false, error: 'locked', code: 'locked' }
  }
  const parsed = planChoiceSchema.safeParse(input)
  const step = parsed.success ? resolveOutreachStep(parsed.data.planStep) : null
  if (!parsed.success || !step) return { ok: false, error: 'Invalid plan.', code: 'invalid' }
  // Coming soon (sellable=false): refused on the server, whatever the claim page sent.
  if (!step.sellable) return { ok: false, error: 'not_sellable', code: 'not_sellable' }
  // The tipping system: stored with the claim and charged from publish (subscription creation).
  const tip = parseTipDollars(step, parsed.data.tipDollars)
  if (!tip.ok) return { ok: false, error: 'tip_out_of_range', code: 'tip_out_of_range' }
  const { error } = await db()
    .from('outreach_sites')
    .update({ plan_step: step.id, plan_tip_dollars: tip.tipDollars, updated_at: new Date().toISOString() })
    .eq('id', site.id)
    .eq('claimed_by', userId)
  if (error) return { ok: false, error: 'save', code: 'save' }
  return { ok: true }
}

/**
 * Claim step 4 "Change" (Lina §2): clear the chosen step so the customer picks again on step 3.
 * Only before the card is saved and before Live (the update itself re-checks both, so a card saved
 * in another tab in the meantime wins). The setup Checkout doesn't carry the step.
 */
export async function clearChosenPlan(userId: string): Promise<Result> {
  const site = await getClaimedSiteForUser(userId)
  if (!site) return { ok: false, error: 'no_site', code: 'no_site' }
  if (site.publish_status === 'live' || site.setup_completed_at) return { ok: false, error: 'locked', code: 'locked' }
  const { data, error } = await db()
    .from('outreach_sites')
    .update({ plan_step: null, plan_tip_dollars: null, updated_at: new Date().toISOString() })
    .eq('id', site.id)
    .eq('claimed_by', userId)
    .is('setup_completed_at', null)
    .neq('publish_status', 'live')
    .select('id')
  if (error) return { ok: false, error: 'save', code: 'save' }
  if ((data ?? []).length !== 1) return { ok: false, error: 'locked', code: 'locked' }
  return { ok: true }
}

/** "Card saved, waiting for publish" counts as a plan for the one-plan guard (Aria, section 9). */
export async function hasOutreachPlanWaitingForPublish(userId: string): Promise<boolean> {
  const { data, error } = await db()
    .from('outreach_sites')
    .select('id')
    .eq('claimed_by', userId)
    .not('setup_completed_at', 'is', null)
    .neq('publish_status', 'live')
    .limit(1)
  if (error) throw new Error(error.message)
  return (data ?? []).length > 0
}

/** Claim step 4: setup-mode Checkout (saves the card; nothing is charged). */
export async function startSetupCheckout(user: { id: string; email?: string | null }): Promise<Result<{ url: string }>> {
  const site = await getClaimedSiteForUser(user.id)
  if (!site) return { ok: false, error: 'no_site', code: 'no_site' }
  if (site.setup_completed_at) return { ok: false, error: 'already_saved', code: 'already_saved' }
  const chosen = resolveOutreachStep(site.plan_step)
  if (!chosen) {
    return { ok: false, error: 'no_plan', code: 'no_plan' }
  }
  if (!chosen.sellable) return { ok: false, error: 'not_sellable', code: 'not_sellable' }
  const stripe = getStripe()
  const client = db()
  const { data: prof } = await client.from('profiles').select('stripe_customer_id').eq('id', user.id).maybeSingle()
  const saved = (prof?.stripe_customer_id as string | null) ?? site.stripe_customer_id ?? null
  const { customerIds, ownCustomerId } = await findCustomersToCheck(stripe, user, saved)
  const live = (await Promise.all(customerIds.map((id) => listLiveSubscriptions(id)))).flat()
  if (live.length > 0) return { ok: false, error: 'already_has_plan', code: 'already_has_plan' }
  // Card R7: setup Checkout in the customer's language (nothing changes with the gate off).
  const locale = await readProfileLocale(client, user.id)
  const customerId = ownCustomerId ?? (await createCheckoutCustomer(stripe, user, locale))
  const base = appBaseUrl()
  // Every Checkout Session expires an hour after it is created (Aria, Oct 3 12:56).
  const expiresAt = checkoutSessionExpiresAt()
  const session = await stripe.checkout.sessions.create(
    {
      mode: 'setup',
      currency: 'usd',
      expires_at: expiresAt,
      customer: customerId,
      success_url: `${base}/claim?setup=success&session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${base}/claim?setup=cancelled`,
      ...stripeLocaleParam(locale),
      metadata: { type: 'outreach_setup', outreach_site_id: site.id, supabase_user_id: user.id },
      setup_intent_data: {
        metadata: { type: 'outreach_setup', outreach_site_id: site.id, supabase_user_id: user.id },
      },
    },
    { idempotencyKey: `outreach-setup:${site.id}:${expiresAt}${localeKeyPart(locale)}` }
  )
  if (!session.url) return { ok: false, error: 'no_url', code: 'no_url' }
  const { error } = await client
    .from('outreach_sites')
    .update({ setup_session_id: session.id, stripe_customer_id: customerId, updated_at: new Date().toISOString() })
    .eq('id', site.id)
    .eq('claimed_by', user.id)
  if (error) return { ok: false, error: 'save', code: 'save' }
  return { ok: true, url: session.url }
}

// ----------------------------------------------------------------------------- billing store / webhook

function billingStore(): OutreachBillingStore {
  const client = db()
  const one = async (col: string, value: string) => {
    const { data } = await client.from('outreach_sites').select(SITE_COLUMNS).eq(col, value).maybeSingle()
    return (data as OutreachBillingSite | null) ?? null
  }
  return {
    getSite: (id) => one('id', id),
    getSiteBySetupSession: (sessionId) => one('setup_session_id', sessionId),
    getSiteBySubscription: (subId) => one('stripe_subscription_id', subId),
    async beginPublish(id) {
      const { data, error } = await client
        .from('outreach_sites')
        .update({ publish_status: 'processing', publish_error: null, updated_at: new Date().toISOString() })
        .eq('id', id)
        .in('publish_status', ['none', 'failed'])
        .select('id')
      return !error && (data ?? []).length === 1
    },
    async updateSite(id, patch: OutreachSitePatch) {
      const { error } = await client.from('outreach_sites').update({ ...patch, updated_at: new Date().toISOString() }).eq('id', id)
      if (error) throw new Error(error.message)
    },
    async setProfileCustomer(userId, customerId) {
      await client
        .from('profiles')
        .update({ stripe_customer_id: customerId, updated_at: new Date().toISOString() })
        .eq('id', userId)
        .is('stripe_customer_id', null)
    },
  }
}

/** Webhook: checkout.session.completed in setup mode (saves the card). */
export async function handleOutreachSetupSession(session: Stripe.Checkout.Session) {
  return completeSetupSession({ stripe: getStripe(), store: billingStore() }, session)
}

/** Return-URL fallback for the webhook (freeplug-in.dev webhooks may not be deliverable yet). */
export async function syncSetupSessionForUser(userId: string, sessionId: string): Promise<void> {
  if (!/^cs_[A-Za-z0-9_]+$/.test(sessionId)) return
  const site = await getClaimedSiteForUser(userId)
  if (!site || site.setup_session_id !== sessionId || site.setup_completed_at) return
  try {
    const session = await getStripe().checkout.sessions.retrieve(sessionId)
    await handleOutreachSetupSession(session)
  } catch (e) {
    console.error('[outreach] setup sync', e instanceof Error ? e.message : e)
  }
}

export async function handleOutreachInvoicePaid(invoice: Stripe.Invoice): Promise<boolean> {
  return markLiveFromPaidInvoice({ stripe: getStripe(), store: billingStore() }, invoice)
}

// ----------------------------------------------------------------------------- admin

/** What happened to a closed old preview row's photos (Sable 1:36 AM lines). */
export type ClosedPreviewOutcome = 'applied' | 'rejected' | 'pending' | 'no_photos'

export type AdminOutreachRow = OutreachSiteRow & {
  claimerEmail: string | null
  /** Old preview rows closed once the customer's row was reviewed: one grey line each. */
  closedPreviewSubmissions: { id: string; submitted_at: string; outcome: ClosedPreviewOutcome }[]
  pendingSubmissions: {
    id: string
    source: string
    fields: Record<string, string>
    /** added: a kept name that isn't on the site's current list (shown as "Add: …", Vera r2 bug 8). */
    services: { name: string; keep: boolean; added: boolean }[]
    photoCount: number
    /** Preview rows: how many of their photos were carried into the customer's confirmed details. */
    photosMoved: number
    submitted_at: string
    stale: boolean
  }[]
  pendingChanges: { id: string; change_type: string; description: string; created_at: string }[]
  photoCount: number
  /** Approved photos whose stored copy Freeplug still keeps (admin can delete them once on the site). */
  storedApprovedPhotoCount: number
  customerConfirmedAt: string | null
}

export async function adminListOutreachSites(): Promise<AdminOutreachRow[]> {
  await assertAdminAccess()
  const client = db()
  const { data: sites, error } = await client.from('outreach_sites').select(SITE_COLUMNS).order('created_at', { ascending: false })
  if (error) throw new Error(error.message)
  const list = (sites ?? []) as OutreachSiteRow[]
  const ids = list.map((s) => s.id)
  if (ids.length === 0) return []
  const [subs, changes, photos, details] = await Promise.all([
    client
      .from('site_details_submissions')
      .select('id, outreach_site_id, source, fields, services, submitted_at, review_status')
      .in('outreach_site_id', ids)
      .in('review_status', ['pending', 'superseded'])
      .order('submitted_at'),
    client.from('outreach_change_requests').select('id, outreach_site_id, change_type, description, created_at').in('outreach_site_id', ids).eq('review_status', 'pending').order('created_at'),
    client.from('site_photos').select('id, outreach_site_id, submission_id, review_status, file_deleted_at').in('outreach_site_id', ids),
    client.from('site_details').select('outreach_site_id, customer_confirmed_at, services, applied_submission_id').in('outreach_site_id', ids),
  ])
  const confirmed = new Map((details.data ?? []).map((d) => [d.outreach_site_id as string, d.customer_confirmed_at as string | null]))
  // The list a submission's answers are compared with: the approved list once something was
  // applied, else the site's own list (same rule as apply_site_details_submission).
  const approvedServices = new Map(
    (details.data ?? [])
      .filter((d) => d.applied_submission_id != null)
      .map((d) => [d.outreach_site_id as string, (d.services as string[] | null) ?? []])
  )
  const pendingSubs = (subs.data ?? []).filter((r) => r.review_status === 'pending')
  // Old preview rows closed automatically once the customer's row was reviewed (Vera r3 NEW-1).
  const closedSubs = (subs.data ?? []).filter((r) => r.review_status === 'superseded' && r.source === 'preview')
  // Preview photos carried into a customer's step 2 submission count (and show) on that row.
  const subIds = pendingSubs.map((r) => r.id as string)
  // Only photos whose stored file still exists count, so "View n photos" never opens an empty
  // viewer after "Delete photos" (Vera r3 NEW-2; submissionPhotosAction skips deleted files too).
  const storedPhotoIds = new Set((photos.data ?? []).filter((p) => !p.file_deleted_at).map((p) => p.id as string))
  const carried = (
    subIds.length
      ? ((await client.from('site_submission_carried_photos').select('submission_id, photo_id').in('submission_id', subIds)).data ?? [])
      : []
  ).filter((c) => storedPhotoIds.has(c.photo_id as string))
  // Photos of preview rows (open or closed) carried into a customer submission, and where that
  // customer row stands: pending on an open old row gives Sable's 1:18 AM note; on a closed row
  // the 1:36 AM line says whether they were approved or rejected there.
  const previewSubIds = new Set((subs.data ?? []).filter((r) => r.source === 'preview').map((r) => r.id as string))
  const previewPhotoIds = (photos.data ?? []).filter((p) => previewSubIds.has(p.submission_id as string)).map((p) => p.id as string)
  const moves = previewPhotoIds.length
    ? ((await client.from('site_submission_carried_photos').select('photo_id, submission_id').in('photo_id', previewPhotoIds)).data ?? [])
    : []
  const carrierIds = [...new Set(moves.map((m) => m.submission_id as string))]
  const carrierStatus = new Map(
    (carrierIds.length
      ? ((await client.from('site_details_submissions').select('id, review_status').in('id', carrierIds)).data ?? [])
      : []
    ).map((c) => [c.id as string, c.review_status as string])
  )
  const movedTo = new Map(moves.map((m) => [m.photo_id as string, carrierStatus.get(m.submission_id as string) ?? 'pending']))
  const emails = new Map<string, string | null>()
  for (const s of list) {
    if (s.claimed_by && !emails.has(s.claimed_by)) {
      const { data } = await client.auth.admin.getUserById(s.claimed_by)
      emails.set(s.claimed_by, data?.user?.email ?? null)
    }
  }
  return list.map((s) => {
    const c = confirmed.get(s.id) ?? null
    const base = approvedServices.get(s.id) ?? s.services ?? []
    return {
      ...s,
      claimerEmail: s.claimed_by ? emails.get(s.claimed_by) ?? null : null,
      customerConfirmedAt: c,
      closedPreviewSubmissions: closedSubs
        .filter((r) => r.outreach_site_id === s.id)
        .map((r) => {
          const own = (photos.data ?? []).filter((p) => p.submission_id === r.id).map((p) => movedTo.get(p.id as string))
          const outcome: ClosedPreviewOutcome =
            own.length === 0 ? 'no_photos' : own.includes('rejected') ? 'rejected' : own.includes('applied') ? 'applied' : own.some((x) => x === 'pending') ? 'pending' : 'no_photos'
          return { id: r.id as string, submitted_at: r.submitted_at as string, outcome }
        }),
      pendingSubmissions: pendingSubs
        .filter((r) => r.outreach_site_id === s.id)
        .map((r) => ({
          id: r.id as string,
          source: r.source as string,
          fields: r.fields as Record<string, string>,
          services: ((r.services as { name: string; keep: boolean }[] | null) ?? []).map((x) => ({
            name: x.name,
            keep: x.keep,
            added: x.keep && !base.includes(x.name),
          })),
          photoCount:
            (photos.data ?? []).filter((p) => p.submission_id === r.id && storedPhotoIds.has(p.id as string)).length +
            carried.filter((c) => c.submission_id === r.id).length,
          photosMoved: (photos.data ?? []).filter((p) => p.submission_id === r.id && storedPhotoIds.has(p.id as string) && movedTo.get(p.id as string) === 'pending').length,
          submitted_at: r.submitted_at as string,
          stale: r.source === 'preview' && c != null && new Date(r.submitted_at as string) < new Date(c),
        })),
      pendingChanges: (changes.data ?? [])
        .filter((r) => r.outreach_site_id === s.id)
        .map((r) => ({ id: r.id as string, change_type: r.change_type as string, description: r.description as string, created_at: r.created_at as string })),
      photoCount: (photos.data ?? []).filter((r) => r.outreach_site_id === s.id && r.review_status !== 'rejected').length,
      storedApprovedPhotoCount: (photos.data ?? []).filter(
        (r) => r.outreach_site_id === s.id && r.review_status === 'applied' && !r.file_deleted_at
      ).length,
    }
  })
}

function previewLink(token: string): string {
  return `${emailBaseUrl()}/p/${token}`
}

export async function adminCreateOutreachSite(input: unknown): Promise<Result<{ siteId: string; link: string }>> {
  await assertAdminAccess()
  const parsed = adminCreateSiteSchema.safeParse(input)
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0]?.message ?? 'Invalid input.' }
  const { token, tokenHash } = generatePreviewToken()
  const prefill: Record<string, { value: string; source: string; source_url: string }> = {}
  for (const [k, v] of Object.entries(parsed.data.prefill)) {
    if (v.value) prefill[k] = { value: v.value, source: v.source || 'website', source_url: v.source_url }
  }
  const { data, error } = await db()
    .from('outreach_sites')
    .insert({
      business_name: parsed.data.businessName,
      contact_email: parsed.data.contactEmail || null,
      token_hash: tokenHash,
      expires_at: linkExpiryFrom().toISOString(),
      prefill,
      services: parsed.data.services.map((x) => x.name),
      service_sources: parsed.data.services.map((x) => ({ name: x.name, source_label: x.source, source_url: x.source_url })),
    })
    .select('id')
    .single()
  if (error || !data) return { ok: false, error: error?.message ?? 'Could not save.' }
  return { ok: true, siteId: data.id as string, link: previewLink(token) }
}

export async function adminUploadScreenshot(siteId: string, kind: 'desktop' | 'mobile', file: unknown): Promise<Result> {
  await assertAdminAccess()
  if (!(file instanceof Blob)) return { ok: false, error: ERROR_BAD_FILE_ADMIN }
  const checked = await processUploadedImage(new Uint8Array(await file.arrayBuffer()), 'screenshot')
  if (!checked.ok) return { ok: false, error: checked.reason === 'too_large' ? 'Screenshot is over 5 MB after resizing.' : ERROR_BAD_FILE_ADMIN }
  const site = await siteById(siteId)
  if (!site) return { ok: false, error: 'Site not found.' }
  const path = `outreach/${site.id}/screenshot-${kind}-${randomObjectName()}.jpg`
  const client = db()
  const up = await client.storage.from(OUTREACH_BUCKET).upload(path, checked.image.data, { contentType: 'image/jpeg', upsert: false })
  if (up.error) return { ok: false, error: up.error.message }
  const col = kind === 'desktop' ? 'screenshot_desktop_path' : 'screenshot_mobile_path'
  const { error } = await client.from('outreach_sites').update({ [col]: path, updated_at: new Date().toISOString() }).eq('id', site.id)
  if (error) return { ok: false, error: error.message }
  return { ok: true }
}
const ERROR_BAD_FILE_ADMIN = 'Use a JPG, PNG or WebP screenshot.'

export async function adminExtendLink(siteId: string): Promise<Result> {
  await assertAdminAccess()
  const site = await siteById(siteId)
  if (!site) return { ok: false, error: 'Site not found.' }
  const { error } = await db()
    .from('outreach_sites')
    .update({ expires_at: extendedExpiry(new Date(site.expires_at)).toISOString(), updated_at: new Date().toISOString() })
    .eq('id', siteId)
  return error ? { ok: false, error: error.message } : { ok: true }
}

export async function adminRevokeLink(siteId: string): Promise<Result> {
  await assertAdminAccess()
  const { error } = await db()
    .from('outreach_sites')
    .update({ revoked_at: new Date().toISOString(), updated_at: new Date().toISOString() })
    .eq('id', siteId)
    .is('revoked_at', null)
  return error ? { ok: false, error: error.message } : { ok: true }
}

/** Clears the claim, revokes the old token and issues a new 30-day link (Aria, section 2). */
export async function adminUnclaimAndReissue(siteId: string): Promise<Result<{ link: string }>> {
  await assertAdminAccess()
  const site = await siteById(siteId)
  if (!site) return { ok: false, error: 'Site not found.' }
  if (site.publish_status === 'live' || site.publish_status === 'processing') {
    return { ok: false, error: 'A published site cannot be unclaimed here.' }
  }
  const { token, tokenHash } = generatePreviewToken()
  const client = db()
  const { error } = await client
    .from('outreach_sites')
    .update({
      claimed_by: null,
      claimed_at: null,
      token_hash: tokenHash,
      revoked_at: null,
      declined_at: null,
      expires_at: linkExpiryFrom().toISOString(),
      plan_step: null,
      plan_tip_dollars: null,
      plan_hosting_cents: null,
      plan_addon_tier: null,
      setup_session_id: null,
      setup_completed_at: null,
      stripe_customer_id: null,
      stripe_payment_method_id: null,
      stripe_subscription_id: null,
      publish_status: 'none',
      publish_error: null,
      claimer_verified_at: null,
      updated_at: new Date().toISOString(),
    })
    .eq('id', siteId)
  if (error) return { ok: false, error: error.message }
  // The old claimer's outreach request no longer points at this site.
  await client
    .from('website_requests')
    .update({ outreach_site_id: null, updated_at: new Date().toISOString() })
    .eq('outreach_site_id', siteId)
  return { ok: true, link: previewLink(token) }
}

export async function adminApplySubmission(submissionId: string): Promise<Result> {
  await assertAdminAccess()
  const { error } = await db().rpc('apply_site_details_submission', { p_submission_id: submissionId })
  if (error) return { ok: false, error: error.message }
  return { ok: true }
}

/**
 * Rejects the submission and the photos it reviews, in one transaction. Rejecting a stale preview
 * row leaves the photos carried into the customer's step 2 row pending there.
 */
export async function adminRejectSubmission(submissionId: string): Promise<Result> {
  await assertAdminAccess()
  const { error } = await db().rpc('reject_site_details_submission', { p_submission_id: submissionId })
  if (!error) return { ok: true }
  // Sable 1:34 AM: an applied row can't be rejected (it used to return ok and change nothing).
  if (error.hint === 'already_applied') return { ok: false, error: ADMIN_REJECT_ALREADY_APPLIED }
  return { ok: false, error: error.message }
}

/**
 * Short-lived signed links to one submission's photos, for the admin review row: its own photos
 * plus, on the customer's step 2 row, the preview photos carried into it.
 */
export async function adminSubmissionPhotoUrls(submissionId: string): Promise<string[]> {
  await assertAdminAccess()
  if (!UUID_RE.test(submissionId)) return []
  const client = db()
  const { data: links } = await client.from('site_submission_carried_photos').select('photo_id').eq('submission_id', submissionId)
  const carriedIds = (links ?? []).map((l) => l.photo_id as string)
  const [own, carried] = await Promise.all([
    client.from('site_photos').select('id, storage_path, created_at').eq('submission_id', submissionId).is('file_deleted_at', null),
    carriedIds.length
      ? client.from('site_photos').select('id, storage_path, created_at').in('id', carriedIds).is('file_deleted_at', null)
      : Promise.resolve({ data: [] as { id: string; storage_path: string; created_at: string }[] }),
  ])
  const byId = new Map<string, { storage_path: string; created_at: string }>()
  for (const r of [...(carried.data ?? []), ...(own.data ?? [])] as { id: string; storage_path: string; created_at: string }[]) byId.set(r.id, r)
  const paths = [...byId.values()].sort((x, y) => x.created_at.localeCompare(y.created_at)).map((r) => r.storage_path)
  if (paths.length === 0) return []
  const signed = await client.storage.from(OUTREACH_BUCKET).createSignedUrls(paths, SIGNED_URL_SECONDS)
  return (signed.data ?? []).map((x) => x.signedUrl).filter((u): u is string => Boolean(u))
}

/**
 * After approved photos were added to the site, delete Freeplug's stored copies (Jace, Sep 27):
 * files first (Storage API), then file_deleted_at on those rows. The rows stay, so the preview
 * link's lifetime count never goes down. Only 'applied' photos; the database refuses the rest.
 */
export async function adminDeleteAppliedPhotoFiles(siteId: string): Promise<Result<{ deleted: number }>> {
  await assertAdminAccess()
  return deleteAppliedPhotoFiles(siteId)
}

async function deleteAppliedPhotoFiles(siteId: string): Promise<Result<{ deleted: number }>> {
  if (!UUID_RE.test(siteId)) return { ok: false, error: 'Site not found.' }
  const client = db()
  const { data, error } = await client
    .from('site_photos')
    .select('id, storage_path')
    .eq('outreach_site_id', siteId)
    .eq('review_status', 'applied')
    .is('file_deleted_at', null)
    .limit(1000)
  if (error) return { ok: false, error: error.message }
  const rows = (data ?? []) as { id: string; storage_path: string }[]
  let deleted = 0
  for (let i = 0; i < rows.length; i += 100) {
    const batch = rows.slice(i, i + 100)
    const rm = await client.storage.from(OUTREACH_BUCKET).remove(batch.map((r) => r.storage_path))
    if (rm.error) {
      console.error('[outreach] delete approved photo files', rm.error.message)
      return { ok: false, error: rm.error.message }
    }
    const up = await client
      .from('site_photos')
      .update({ file_deleted_at: new Date().toISOString() })
      .in(
        'id',
        batch.map((r) => r.id)
      )
      .is('file_deleted_at', null)
    if (up.error) return { ok: false, error: up.error.message }
    deleted += batch.length
  }
  return { ok: true, deleted }
}

export async function adminReviewChangeRequest(id: string, status: 'applied' | 'rejected'): Promise<Result> {
  await assertAdminAccess()
  const { error } = await db()
    .from('outreach_change_requests')
    .update({ review_status: status, reviewed_at: new Date().toISOString() })
    .eq('id', id)
    .eq('review_status', 'pending')
  return error ? { ok: false, error: error.message } : { ok: true }
}

export async function adminPublishSite(siteId: string, opts: { claimerVerified: boolean; liveUrl?: string | null }) {
  await assertAdminAccess()
  const liveUrl = opts.liveUrl?.trim() || null
  if (liveUrl && !/^https?:\/\/\S+$/.test(liveUrl)) {
    return { ok: false as const, status: 'refused' as const, error: 'Live website address must start with https://' }
  }
  return publishOutreachSite({ stripe: getStripe(), store: billingStore() }, siteId, { ...opts, liveUrl })
}

export async function adminListDomainRequests() {
  await assertAdminAccess()
  const client = db()
  const { data } = await client
    .from('domain_requests')
    .select('id, user_id, kind, domain, status, created_at')
    .order('created_at', { ascending: false })
    .limit(50)
  const rows = data ?? []
  const emails = new Map<string, string | null>()
  for (const r of rows) {
    if (!emails.has(r.user_id as string)) {
      const { data: u } = await client.auth.admin.getUserById(r.user_id as string)
      emails.set(r.user_id as string, u?.user?.email ?? null)
    }
  }
  return rows.map((r) => ({ ...r, email: emails.get(r.user_id as string) ?? null })) as {
    id: string
    user_id: string
    kind: 'have_domain' | 'need_domain'
    domain: string | null
    status: string
    created_at: string
    email: string | null
  }[]
}

export async function adminMarkDomainRequestDone(id: string): Promise<Result> {
  await assertAdminAccess()
  const { error } = await db().from('domain_requests').update({ status: 'done' }).eq('id', id)
  return error ? { ok: false, error: error.message } : { ok: true }
}

/** Customer dashboard "View my preview": screenshots through signed URLs for the claimer only. */
export async function customerScreenshotUrls(userId: string): Promise<ScreenshotUrls | null> {
  const site = await getClaimedSiteForUser(userId)
  if (!site) return null
  return screenshotUrlsFor(site)
}

// ----------------------------------------------------------------------------- 90-day photo cleanup

export const PREVIEW_PHOTO_RETENTION_DAYS = 90

/**
 * Deletes photos sent from previews that were never claimed, once they are older than 90 days:
 * files first (Storage API), then the rows (purge_site_photos re-checks the rules in SQL).
 * Cron-ready (no request context needed); today it runs from the admin Outreach page.
 */
export async function cleanupUnclaimedPreviewPhotos(now: Date = new Date()): Promise<{ deleted: number; files: number }> {
  const client = db()
  const cutoff = new Date(now.getTime() - PREVIEW_PHOTO_RETENTION_DAYS * 86_400_000).toISOString()
  const { data, error } = await client
    .from('site_photos')
    .select('id, storage_path, outreach_sites!inner(claimed_by)')
    .eq('source', 'preview')
    .lt('created_at', cutoff)
    .is('outreach_sites.claimed_by', null)
    .limit(1000)
  if (error) throw new Error(error.message)
  const rows = (data ?? []) as unknown as { id: string; storage_path: string }[]
  let files = 0
  const removable: string[] = []
  for (let i = 0; i < rows.length; i += 100) {
    const batch = rows.slice(i, i + 100)
    const rm = await client.storage.from(OUTREACH_BUCKET).remove(batch.map((r) => r.storage_path))
    if (rm.error) {
      console.error('[outreach] photo cleanup storage', rm.error.message)
      continue
    }
    files += batch.length
    removable.push(...batch.map((r) => r.id))
  }
  if (removable.length === 0) return { deleted: 0, files }
  const { data: n, error: purgeError } = await client.rpc('purge_site_photos', {
    p_photo_ids: removable,
    p_older_than: `${PREVIEW_PHOTO_RETENTION_DAYS} days`,
  })
  if (purgeError) throw new Error(purgeError.message)
  return { deleted: Number(n ?? 0), files }
}

export async function adminCleanupUnclaimedPreviewPhotos() {
  await assertAdminAccess()
  return cleanupUnclaimedPreviewPhotos()
}
