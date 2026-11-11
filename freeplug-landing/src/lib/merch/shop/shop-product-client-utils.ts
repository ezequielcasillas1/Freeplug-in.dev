import type { ShopCatalogItem } from './types'
import { MERCH_SHOP_FREE_SHIPPING_THRESHOLD_CENTS } from './types'

/** Client-safe helpers (no shop-catalog.json import). */
export function shopProductImageSrc(item: ShopCatalogItem, index = 0): string {
  return item.gallery[index] ?? item.gridImage ?? '/merch/shop/placeholder-product.svg'
}

export function shopShippingCents(item: ShopCatalogItem, quantity: number, unitAmountCents: number): number {
  if (quantity < 1) return 0
  const merchandiseSubtotalCents = unitAmountCents * quantity
  if (merchandiseSubtotalCents > MERCH_SHOP_FREE_SHIPPING_THRESHOLD_CENTS) return 0
  return item.shippingFirstCents + item.shippingAdditionalCents * (quantity - 1)
}
