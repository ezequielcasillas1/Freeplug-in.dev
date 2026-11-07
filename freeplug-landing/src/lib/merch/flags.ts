/**
 * Merch feature flags (Worker vars / .env.local). Repo defaults are OFF for safe previews;
 * production launch sets both to true — see docs/MERCH-DEPLOY-CHECKLIST.md.
 */
export function isMerchCheckoutEnabled(env: Record<string, string | undefined> = process.env): boolean {
  return env.MERCH_CHECKOUT_ENABLED?.trim().toLowerCase() === 'true'
}

export function isMerchPersonalDownloadEnabled(env: Record<string, string | undefined> = process.env): boolean {
  return env.MERCH_PERSONAL_DOWNLOAD_ENABLED?.trim().toLowerCase() === 'true'
}
