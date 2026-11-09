import { notFound, permanentRedirect } from 'next/navigation'
import { CollectionProductClient } from '@/features/merch/components/CollectionProductClient'
import { GivingVersesProductClient } from '@/features/merch/components/GivingVersesProductClient'
import {
  GIVING_VERSES_PRODUCT_SLUG,
  GOOD_MEASURE_LEGACY_SLUG,
} from '@/lib/merch/collections/giving-verses'
import { isMerchCollectionsEnabled } from '@/lib/merch/flags'
import {
  MERCH_COLLECTIONS,
  getCatalogProduct,
  listPublicCollectionProducts,
  type MerchCollectionSlug,
} from '@/lib/merch/collections/catalog'

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
  params: Promise<{ locale: string; collection: string; slug: string }>
}) {
  const { locale, collection, slug } = await params
  if (!isMerchCollection(collection)) notFound()

  if (slug === GOOD_MEASURE_LEGACY_SLUG) {
    const prefix = locale === 'es' ? '/es' : ''
    permanentRedirect(`${prefix}/merch/${collection}/${GIVING_VERSES_PRODUCT_SLUG}`)
  }

  const entry = getCatalogProduct(slug)
  if (!entry || entry.collection !== collection) notFound()
  const product = listPublicCollectionProducts(collection).find((p) => p.slug === slug)!
  const checkoutEnabled = isMerchCollectionsEnabled()

  if (slug === GIVING_VERSES_PRODUCT_SLUG) {
    return (
      <GivingVersesProductClient collection={collection} product={product} checkoutEnabled={checkoutEnabled} />
    )
  }

  return <CollectionProductClient collection={collection} product={product} checkoutEnabled={checkoutEnabled} />
}
