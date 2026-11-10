import { Suspense } from 'react'
import { listPublicShirtProducts } from '@/lib/merch/shirts/catalog'
import { TshirtsListClient } from '@/features/merch/components/TshirtsListClient'

export default function MerchTshirtsPage() {
  const products = listPublicShirtProducts()
  return (
    <Suspense fallback={<div className="min-h-screen bg-zinc-50" />}>
      <TshirtsListClient products={products} />
    </Suspense>
  )
}
