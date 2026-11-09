import { MERCH_SHOP_CANCEL_WINDOW_MS, MERCH_SHOP_HELD_AUTO_REFUND_MS, isMerchCustomAutosendEnabled } from './flags-custom'
import type { ShopModerationResult } from './moderation'
import type { MerchShopOrderStatus } from './orders'

export type ShopDesignMode = 'freeplug' | 'custom'

export function initialShopOrderStatus(opts: {
  designMode: ShopDesignMode
  moderation: ShopModerationResult | null
  autosend: boolean
}): MerchShopOrderStatus {
  if (opts.designMode === 'freeplug') return 'pending_review'
  if (opts.moderation === 'held') return 'held_moderation'
  if (!opts.autosend) return 'pending_review'
  return 'paid_cancellable'
}

export function cancelUntilIso(paidAt: Date): string {
  return new Date(paidAt.getTime() + MERCH_SHOP_CANCEL_WINDOW_MS).toISOString()
}

export function heldUntilIso(paidAt: Date): string {
  return new Date(paidAt.getTime() + MERCH_SHOP_HELD_AUTO_REFUND_MS).toISOString()
}

export function shouldQueuePrintify(status: MerchShopOrderStatus, cancelUntil: string | null, now = new Date()): boolean {
  if (status !== 'paid_cancellable') return false
  if (!cancelUntil) return false
  return now.getTime() >= Date.parse(cancelUntil)
}

export function shouldAutoRefundHeld(status: MerchShopOrderStatus, heldUntil: string | null, now = new Date()): boolean {
  if (status !== 'held_moderation') return false
  if (!heldUntil) return false
  return now.getTime() >= Date.parse(heldUntil)
}

export function autosendEnabledForOrder(env: Record<string, string | undefined> = process.env): boolean {
  return isMerchCustomAutosendEnabled(env)
}
