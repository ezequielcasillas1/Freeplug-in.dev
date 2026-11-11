import { Suspense, type ReactNode } from 'react'
import { ShopGridCardMockup } from '@/features/merch/components/ShopGridCardMockup'
import { ShopListClient } from '@/features/merch/components/ShopListClient'
import { listShopFilterItems } from '@/lib/merch/shop/shop-filter-items'

export const dynamic = 'force-static'

export default function ShopIndexPage() {
  const items = listShopFilterItems()
  const gridMockups: Record<string, ReactNode> = {}
  for (const item of items) {
    gridMockups[item.key] = <ShopGridCardMockup item={item} />
  }
  return (
    <Suspense fallback={<div className="min-h-screen bg-zinc-50" />}>
      <ShopListClient items={items} gridMockups={gridMockups} />
    </Suspense>
  )
}
