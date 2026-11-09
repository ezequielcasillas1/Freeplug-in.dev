import { Suspense } from 'react'
import { ShopListClient } from '@/features/merch/components/ShopListClient'
import { computeCatalogFacets, facetKeysSorted } from '@/lib/merch/catalog-filter-logic'
import { listShopFilterItems } from '@/lib/merch/shop/shop-filter-items'

export const dynamic = 'force-static'

export default function ShopIndexPage() {
  const items = listShopFilterItems()
  const facets = computeCatalogFacets(items)
  const facetLists = {
    productTypeKeys: facetKeysSorted(facets.productTypes, 40),
    colorKeys: facetKeysSorted(facets.colors, 60),
    sizeKeys: facetKeysSorted(facets.sizes, 40),
  }

  return (
    <Suspense fallback={<div className="min-h-screen bg-zinc-50" />}>
      <ShopListClient items={items} facets={facets} facetLists={facetLists} />
    </Suspense>
  )
}
