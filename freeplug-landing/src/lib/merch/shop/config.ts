/**
 * Merch shop preview toggles (Worker vars / .env.local).
 * MERCH_SHOP_CUSTOM_DESIGN_FEE_CENTS — optional add-on per custom-art line item (default 0).
 */
export function merchShopCustomDesignFeeCents(env: Record<string, string | undefined> = process.env): number {
  const raw = env.MERCH_SHOP_CUSTOM_DESIGN_FEE_CENTS?.trim()
  if (!raw) return 0
  const n = parseInt(raw, 10)
  return Number.isFinite(n) && n >= 0 ? n : 0
}
