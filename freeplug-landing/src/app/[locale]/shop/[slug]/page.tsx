import { notFound } from 'next/navigation'
import { getShopItem, listShopItems, shopHasPrintifyFreeplug } from '@/lib/merch/shop/catalog'
import { ShopProductClient } from '@/features/merch/components/ShopProductClient'
import { isMerchCheckoutEnabled } from '@/lib/merch/flags'
import { parseBuyerWordmarkBrand } from '@/lib/merch/preview/buyer-wordmark-brand'
import { parseBuyerWordmarkStyle } from '@/lib/merch/preview/buyer-wordmark-style'

/** Allow `?wordmark_brand=` / `?wordmark_style=` preview URLs (SSR overlay for QA). */
export const dynamic = 'force-dynamic'

export function generateStaticParams() {
  return listShopItems().map((item) => ({ slug: item.slug }))
}

export default async function ShopProductPage({
  params,
  searchParams,
}: {
  params: Promise<{ slug: string }>
  searchParams: Promise<Record<string, string | string[] | undefined>>
}) {
  const { slug } = await params
  const sp = await searchParams
  const item = getShopItem(slug)
  if (!item) notFound()
  const checkoutEnabled = isMerchCheckoutEnabled()
  const hasPrintifyProduct = shopHasPrintifyFreeplug(slug)
  const initialWordmarkBrand = parseBuyerWordmarkBrand(
    typeof sp.wordmark_brand === 'string' ? sp.wordmark_brand : null
  )
  const initialWordmarkStyle = parseBuyerWordmarkStyle(
    typeof sp.wordmark_style === 'string' ? sp.wordmark_style : null
  )
  const initialColor = typeof sp.color === 'string' ? sp.color : null
  return (
    <ShopProductClient
      item={item}
      checkoutEnabled={checkoutEnabled}
      hasPrintifyProduct={hasPrintifyProduct}
      wordmarkBaked={false}
      initialWordmarkBrand={initialWordmarkBrand}
      initialWordmarkStyle={initialWordmarkStyle}
      initialColor={initialColor}
    />
  )
}
