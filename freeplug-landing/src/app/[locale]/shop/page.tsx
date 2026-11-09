import { listShopCards } from '@/lib/merch/shop/catalog'
import { ShopListClient } from '@/features/merch/components/ShopListClient'

export const dynamic = 'force-static'

export default function ShopIndexPage() {
  const cards = listShopCards()
  return <ShopListClient cards={cards} initialTab="all" />
}
