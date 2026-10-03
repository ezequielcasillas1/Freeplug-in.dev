/**
 * Photo limits in one place (Ezequiel, Sep 27 12:04 AM CT). The database cap in
 * supabase/migrations/20260927050200_site_details.sql (site_photos_enforce_cap) uses the same
 * number; limits.test.ts fails if the two drift apart.
 */
export const PHOTO_LIMITS = {
  /**
   * Anonymous preview link: lifetime cap, counted across every send from that link (retries
   * count once). Database: site_photos_enforce_cap, cap_preview_link.
   */
  maxPerLink: 50,
  /**
   * Signed-in claimed customer: per upload request (one submission = one request), no lifetime
   * cap; still rate limited per account (LIMITS.customerPhotoPerUser in server.ts).
   * Database: cap_customer_request. (Jace, Sep 27 12:40 AM; product call pending Ezequiel.)
   */
  maxPerCustomerRequest: 50,
  /** Organic customers (no outreach site): unchanged, lifetime per account. Database: cap_organic_account. */
  maxPerOrganicAccount: 50,
  /** Checked in the browser on the original file, before HEIC conversion and resizing. */
  maxOriginalBytes: 10 * 1024 * 1024,
  /**
   * After the browser shrinks a photo it must be at most this size, or it is refused before
   * upload; the server refuses anything bigger too (Netlify's request body limit is about 6 MB).
   */
  maxUploadBytes: 5 * 1024 * 1024,
  /** Longest side after the browser resize (and again on the server). */
  maxDimension: 2560,
  /** Photos uploaded at once. */
  uploadConcurrency: 3,
} as const

export const MAX_PHOTOS = PHOTO_LIMITS.maxPerLink
