import { Suspense } from 'react'
import { ShopListClient } from '@/features/merch/components/ShopListClient'
import { listShopFilterItems } from '@/lib/merch/shop/shop-filter-items'
import { shopGridMockupPropsForItem } from '@/lib/merch/shop/shop-grid-mockup-props'

export const dynamic = 'force-static'

export default function ShopIndexPage() {
  const items = listShopFilterItems()
  const gridMockupProps: Record<string, ReturnType<typeof shopGridMockupPropsForItem>> = {}
  for (const item of items) {
    gridMockupProps[item.key] = shopGridMockupPropsForItem(item)
  }
  return (
    <Suspense fallback={<div className="min-h-screen bg-zinc-50" />}>
      <ShopListClient items={items} gridMockupProps={gridMockupProps} />
    </Suspense>
  )
}
