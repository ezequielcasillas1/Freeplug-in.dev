import { notFound } from 'next/navigation'
import { getShopItem, listShopItems, shopHasPrintifyFreeplug } from '@/lib/merch/shop/catalog'
import { ShopProductClient } from '@/features/merch/components/ShopProductClient'
import { isMerchCheckoutEnabled } from '@/lib/merch/flags'

export const dynamic = 'force-static'

export function generateStaticParams() {
  return listShopItems().map((item) => ({ slug: item.slug }))
}

export default async function ShopProductPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params
  const item = getShopItem(slug)
  if (!item) notFound()
  const checkoutEnabled = isMerchCheckoutEnabled()
  const hasPrintifyProduct = shopHasPrintifyFreeplug(slug)
  return (
    <ShopProductClient item={item} checkoutEnabled={checkoutEnabled} hasPrintifyProduct={hasPrintifyProduct} />
  )
}
