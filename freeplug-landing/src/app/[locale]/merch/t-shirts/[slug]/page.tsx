import { notFound } from 'next/navigation'
import { isMerchShirtsEnabled } from '@/lib/merch/flags'
import { getShirtBySlug, listPublicShirtProducts } from '@/lib/merch/shirts/catalog'
import { ShirtProductClient } from '@/features/merch/components/ShirtProductClient'
import { attachMerchLayer } from '@/lib/merch/layers/attach-layer'
import { pickOtherLayerMerchItems } from '@/lib/merch/layers/other-layer-picks'

// Read MERCH_SHIRTS_ENABLED at request time (Worker var), not at build time.
export const dynamic = 'force-dynamic'

export function generateStaticParams() {
  return listPublicShirtProducts().map((p) => ({ slug: p.slug }))
}

export default async function MerchShirtProductPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params
  const entry = getShirtBySlug(slug)
  if (!entry) notFound()
  const product = listPublicShirtProducts().find((p) => p.slug === slug)!
  const checkoutEnabled = isMerchShirtsEnabled()
  const catalogKey = `tshirts/${slug}`
  const layer = attachMerchLayer(catalogKey)
  const otherLayerItems = pickOtherLayerMerchItems(catalogKey, layer)
  return (
    <ShirtProductClient product={product} checkoutEnabled={checkoutEnabled} otherLayerItems={otherLayerItems} />
  )
}
