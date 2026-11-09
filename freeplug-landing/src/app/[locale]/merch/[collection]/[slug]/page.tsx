import { notFound } from 'next/navigation'
import { CollectionProductClient } from '@/features/merch/components/CollectionProductClient'
import { isMerchCollectionsEnabled } from '@/lib/merch/flags'
import {
  MERCH_COLLECTIONS,
  getCatalogProduct,
  listPublicCollectionProducts,
  type MerchCollectionSlug,
} from '@/lib/merch/collections/catalog'
import { attachMerchLayer } from '@/lib/merch/layers/attach-layer'
import { pickOtherLayerMerchItems } from '@/lib/merch/layers/other-layer-picks'

export const dynamic = 'force-dynamic'

function isMerchCollection(value: string): value is MerchCollectionSlug {
  return (MERCH_COLLECTIONS as readonly string[]).includes(value)
}

export function generateStaticParams() {
  return MERCH_COLLECTIONS.flatMap((collection) =>
    listPublicCollectionProducts(collection).map((p) => ({ collection, slug: p.slug }))
  )
}

export default async function MerchCollectionProductPage({
  params,
}: {
  params: Promise<{ collection: string; slug: string }>
}) {
  const { collection, slug } = await params
  if (!isMerchCollection(collection)) notFound()
  const entry = getCatalogProduct(slug)
  if (!entry || entry.collection !== collection) notFound()
  const product = listPublicCollectionProducts(collection).find((p) => p.slug === slug)!
  const checkoutEnabled = isMerchCollectionsEnabled()
  const catalogKey = `${collection}/${slug}`
  const layer = attachMerchLayer(catalogKey)
  const otherLayerItems = pickOtherLayerMerchItems(catalogKey, layer)
  return (
    <CollectionProductClient
      collection={collection}
      product={product}
      checkoutEnabled={checkoutEnabled}
      otherLayerItems={otherLayerItems}
    />
  )
}
