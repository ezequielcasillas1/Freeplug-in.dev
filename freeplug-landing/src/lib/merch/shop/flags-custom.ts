/** Hands-off custom shop fulfillment (default off). */
export function isMerchCustomAutosendEnabled(env: Record<string, string | undefined> = process.env): boolean {
  return env.MERCH_CUSTOM_AUTOSEND_ENABLED?.trim().toLowerCase() === 'true'
}

export const MERCH_SHOP_CUSTOM_DAILY_CAP = 20
export const MERCH_SHOP_CANCEL_WINDOW_MS = 60 * 60 * 1000
export const MERCH_SHOP_HELD_AUTO_REFUND_MS = 48 * 60 * 60 * 1000
