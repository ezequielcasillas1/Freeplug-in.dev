import type { AppLocale } from '@/i18n/config'
import { translatorFor } from '@/i18n/translate'
import { intlLocale } from '@/i18n/format'
import type { WebsiteAccess } from '@/lib/website-access'
import { BUYOUT_UNLIMITED_CENTS, buyoutTierSentence, formatTierPrice, type BuyoutTier } from './tiers'

/**
 * Website buyout (Ezequiel, Sep 25, 2026): monthly payments do not count toward owning the site. A
 * customer who wants to keep their website pays a one-time buyout fee; the owner sets the price.
 *
 * Buyout requests reuse the existing website request (maintenance) list: no new table. A request
 * is a buyout request when website_requests.is_buyout is true (migration 20260925204500). Only the
 * server sets it (service role, requestBuyoutQuote); a database trigger stops customers setting or
 * changing it. The notes block (BUYOUT_NOTE_MARKER + timestamp) is informational only: deleting it
 * or pasting it into another request changes nothing. The database allows only one open request per
 * customer (website_requests_one_open_per_user), so a customer has at most one open buyout request.
 *
 * The owner's price lives only in website_requests.buyout_price_cents (migration 20260925204000):
 * admin-only, enforced in the database (trigger: only the service role may set or change it).
 * Notes are customer-editable text, so the price is NEVER read from notes: an old or newly typed
 * price line in the notes has no effect anywhere (admin or customer views).
 */

// Copy from Sable (Sep 25, 2026, 3:15 PM CT). Use exactly.
export const BUYOUT_DASHBOARD_HEADING = 'Want to keep your website?'
// Oct 19 (Cheke): tiers replace the "we'll estimate / ask for a price" wording. Box draft for Sable.
export const BUYOUT_DASHBOARD_BODY =
  "You can buy your website files for a one-time price based on how many pages your site has. Every dollar you've paid counts toward it."
export const BUYOUT_REQUEST_LABEL = 'Request my buyout'
export const BUYOUT_THANKS =
  "Thanks. We got your buyout request. We'll confirm your page count before you pay anything."
export const BUYOUT_CANCEL_HEADING = 'Keep your website'
export const BUYOUT_CANCEL_BODY =
  "Want to keep your website instead of hosting it with us? You can buy the website files for a one-time price based on how many pages it has. Every dollar you've paid counts toward it."
export const BUYOUT_FAQ_QUESTION = 'Can I keep my website if I stop hosting with Freeplug?'
export const BUYOUT_FAQ_ANSWER = `Yes. You can buy your website files for a one-time price based on how many pages your site has: ${buyoutTierSentence()}. That's the most you'd ever pay. Every dollar you've paid us counts toward it. The buyout covers your website files only. Transferring your domain is handled separately.`
/** Admin labels (Sable). */
export const ADMIN_BUYOUT_TYPE_BADGE = 'Buyout'
export const ADMIN_BUYOUT_REQUESTED = 'Buyout requested'
export const ADMIN_BUYOUT_PRICE = 'Buyout price'
export const ADMIN_BUYOUT_QUOTED = 'Buyout quoted'

/**
 * First line of the informational notes block added with a buyout request (admin-facing context:
 * when it was requested). Never used to detect a buyout request; is_buyout is the only signal.
 */
export const BUYOUT_NOTE_MARKER = 'Buyout request (dashboard):'
/** Same limit as the request form notes. */
export const NOTES_MAX = 5000

/** Admin price limits (whole dollars). */
export const BUYOUT_PRICE_MIN_DOLLARS = 1
/** Oct 19 (Luma QA): the override never goes above the Unlimited tier ($2,000), the most anyone pays. */
export const BUYOUT_PRICE_MAX_DOLLARS = BUYOUT_UNLIMITED_CENTS / 100
export const BUYOUT_PRICE_ERROR = 'Enter a whole-dollar amount from $1 to $2,000.'

/**
 * Validates the admin's price input (whole dollars, "$" and thousands commas allowed) and returns
 * cents for buyout_price_cents. Server side: adminSetBuyoutPrice never trusts the client.
 */
export function parseBuyoutPriceInput(
  raw: string
): { ok: true; cents: number } | { ok: false; error: string } {
  const t = String(raw ?? '')
    .trim()
    .replace(/^\$\s*/, '')
    .replace(/,(?=\d{3}(\D|$))/g, '')
  if (!/^\d+$/.test(t)) return { ok: false, error: BUYOUT_PRICE_ERROR }
  const dollars = Number(t)
  if (
    !Number.isSafeInteger(dollars) ||
    dollars < BUYOUT_PRICE_MIN_DOLLARS ||
    dollars > BUYOUT_PRICE_MAX_DOLLARS
  ) {
    return { ok: false, error: BUYOUT_PRICE_ERROR }
  }
  return { ok: true, cents: dollars * 100 }
}

/** "$1,200" / "$1,200.50" for a cents value (admin display). */
export function formatBuyoutPrice(cents: number, locale: AppLocale = 'en'): string {
  const whole = cents % 100 === 0
  return `$${(cents / 100).toLocaleString(intlLocale(locale), {
    minimumFractionDigits: whole ? 0 : 2,
    maximumFractionDigits: 2,
  })}`
}

export function buyoutNoteBlock(now: Date, tier: BuyoutTier | null = null): string {
  const picked = tier ? `\nTier picked: ${tier.label} (${formatTierPrice(tier.cents)})` : ''
  return `${BUYOUT_NOTE_MARKER}\nRequested: ${now.toISOString()}${picked}`
}

/** Dashboard card: shown for active, ending and offline customers (anyone who has had hosting). */
export function showBuyoutCard(access: WebsiteAccess | null): boolean {
  return !!access && access.hasHostingHistory
}

// ---------------------------------------------------------------------------------------------
// Duplicate-safe request (server side). Storage is injected so the guard can be unit tested.
// ---------------------------------------------------------------------------------------------

export type OpenRequestRow = {
  id: string
  notes: string | null
  updated_at: string
  /** website_requests.is_buyout: the only buyout signal. */
  is_buyout: boolean
}
export type RequestDetails = {
  business_name: string | null
  contact_phone: string | null
  google_business_url: string | null
}

export type BuyoutStore = {
  /** The customer's open (submitted or in_review) request, if any. */
  getOpenRequest(userId: string): Promise<OpenRequestRow | null>
  /** Business details of the customer's latest request (any status), to reuse on a new request. */
  getLatestDetails(userId: string): Promise<RequestDetails | null>
  /**
   * Marks the open request as a buyout (is_buyout = true) and sets its notes, only if the row is
   * still open and unchanged since it was read (same updated_at). Returns false when another write
   * got there first.
   */
  markBuyoutIfUnchanged(row: OpenRequestRow, notes: string, now: Date): Promise<boolean>
  /**
   * Inserts a new submitted buyout request (is_buyout = true). 'conflict' = the
   * one-open-request-per-user index fired.
   */
  insertRequest(
    userId: string,
    details: RequestDetails,
    notes: string
  ): Promise<'ok' | 'conflict' | { error: string }>
}

export type BuyoutRequestResult =
  | { ok: true; alreadyRequested: boolean }
  | { ok: false; error: string }

export async function recordBuyoutRequest(
  store: BuyoutStore,
  userId: string,
  now: Date = new Date(),
  locale: AppLocale = 'en',
  tier: BuyoutTier | null = null
): Promise<BuyoutRequestResult> {
  // Customer-facing errors in the customer's language; the note block stays English (admin).
  const t = translatorFor(locale, 'errors.buyout.error')
  const GENERIC_ERROR = t('somethingWentWrongSide')
  const block = buyoutNoteBlock(now, tier)
  // A lost race (another tab, a double click) just means re-reading: the second pass sees the
  // is_buyout flag the first one set and returns alreadyRequested.
  for (let attempt = 0; attempt < 3; attempt++) {
    const open = await store.getOpenRequest(userId)
    if (open?.is_buyout) return { ok: true, alreadyRequested: true }

    if (open) {
      const existing = open.notes?.trim() ?? ''
      const notes = existing ? `${existing}\n\n${block}` : block
      if (notes.length > NOTES_MAX) {
        return {
          ok: false,
          error: t('requestNotesFullEmail'),
        }
      }
      if (await store.markBuyoutIfUnchanged(open, notes, now)) {
        return { ok: true, alreadyRequested: false }
      }
      continue
    }

    const latest = await store.getLatestDetails(userId)
    const res = await store.insertRequest(
      userId,
      {
        business_name: latest?.business_name?.trim() || 'Website buyout',
        contact_phone: latest?.contact_phone ?? null,
        google_business_url: latest?.google_business_url ?? null,
      },
      block
    )
    if (res === 'ok') return { ok: true, alreadyRequested: false }
    if (res === 'conflict') continue
    console.error('[buyout] insert failed', res.error)
    return { ok: false, error: GENERIC_ERROR }
  }
  return { ok: false, error: GENERIC_ERROR }
}
