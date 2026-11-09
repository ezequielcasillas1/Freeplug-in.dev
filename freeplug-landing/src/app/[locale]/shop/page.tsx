import { Suspense } from 'react'
import { ShopListClient } from '@/features/merch/components/ShopListClient'
import { listShopFilterItems } from '@/lib/merch/shop/shop-filter-items'

export const dynamic = 'force-static'

export default function ShopIndexPage() {
  return (
    <Suspense fallback={<div className="min-h-screen bg-zinc-50" />}>
      <ShopListClient items={listShopFilterItems()} />
    </Suspense>
  )
}
