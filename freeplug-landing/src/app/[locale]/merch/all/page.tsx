import { Suspense } from 'react'
import { AllMerchListClient } from '@/features/merch/components/AllMerchListClient'
import { listAllMerchItems } from '@/lib/merch/all-merch'
import { computeCatalogFacets, facetKeysSorted } from '@/lib/merch/catalog-filter-logic'

export const dynamic = 'force-static'

export default function AllMerchPage() {
  const items = listAllMerchItems()
  const facets = computeCatalogFacets(items)
  const facetLists = {
    productTypeKeys: facetKeysSorted(facets.productTypes, 40),
    colorKeys: facetKeysSorted(facets.colors, 60),
    sizeKeys: facetKeysSorted(facets.sizes, 40),
  }

  return (
    <Suspense fallback={<div className="min-h-screen bg-zinc-50" />}>
      <AllMerchListClient items={items} facets={facets} facetLists={facetLists} />
    </Suspense>
  )
}
