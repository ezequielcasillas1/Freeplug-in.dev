import { notFound } from 'next/navigation'
import { CollectionListClient } from '@/features/merch/components/CollectionListClient'
import {
  MERCH_COLLECTIONS,
  listPublicCollectionProducts,
  type MerchCollectionSlug,
} from '@/lib/merch/collections/catalog'

export const dynamic = 'force-dynamic'

function isMerchCollection(value: string): value is MerchCollectionSlug {
  return (MERCH_COLLECTIONS as readonly string[]).includes(value)
}

export function generateStaticParams() {
  return MERCH_COLLECTIONS.map((collection) => ({ collection }))
}

export default async function MerchCollectionPage({ params }: { params: Promise<{ collection: string }> }) {
  const { collection } = await params
  if (!isMerchCollection(collection)) notFound()
  const products = listPublicCollectionProducts(collection)
  return <CollectionListClient collection={collection} products={products} />
}
