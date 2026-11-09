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

export function isMerchShirtsEnabled(env: Record<string, string | undefined> = process.env): boolean {
  return env.MERCH_SHIRTS_ENABLED?.trim().toLowerCase() === 'true'
}

export function isMerchCollectionsEnabled(env: Record<string, string | undefined> = process.env): boolean {
  return env.MERCH_COLLECTIONS_ENABLED?.trim().toLowerCase() === 'true'
}

export function isMerchShopEnabled(env: Record<string, string | undefined> = process.env): boolean {
  return env.MERCH_SHOP_ENABLED?.trim().toLowerCase() === 'true'
}

/** Client nav visibility (set NEXT_PUBLIC_MERCH_SHOP_ENABLED=true alongside MERCH_SHOP_ENABLED for previews). */
export function isMerchShopNavVisible(env: Record<string, string | undefined> = process.env): boolean {
  return env.NEXT_PUBLIC_MERCH_SHOP_ENABLED?.trim().toLowerCase() === 'true'
}
