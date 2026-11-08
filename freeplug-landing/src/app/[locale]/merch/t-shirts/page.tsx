import { listPublicShirtProducts } from '@/lib/merch/shirts/catalog'
import { TshirtsListClient } from '@/features/merch/components/TshirtsListClient'

export default function MerchTshirtsPage() {
  const products = listPublicShirtProducts()
  return <TshirtsListClient products={products} />
}
