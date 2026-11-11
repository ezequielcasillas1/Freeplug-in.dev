import type { CatalogSource } from '@/lib/merch/catalog-filter-types'
import { getPrintifySlugRow } from '@/lib/merch/shop/printify-catalog'
import bakedDb from './wordmark-baked-printify-product-ids.json'

const BAKED_PRINTIFY_IDS = new Set<string>(bakedDb.printifyProductIds)

function printifyIdsForShopSlug(slug: string): string[] {
  const row = getPrintifySlugRow(slug)
  if (!row) return []
  const ids = new Set<string>()
  if (row.printifyProductId?.trim()) ids.add(row.printifyProductId.trim())
  for (const id of Object.values(row.productIdByVariant ?? {})) {
    if (typeof id === 'string' && id.trim()) ids.add(id.trim())
  }
  for (const v of row.variants ?? []) {
    if (v.productId?.trim()) ids.add(v.productId.trim())
  }
  return [...ids]
}

export function shopSlugHasBakedWordmarkPrint(slug: string): boolean {
  return printifyIdsForShopSlug(slug).some((id) => BAKED_PRINTIFY_IDS.has(id))
}

export function isWordmarkBakedInPrintify(input: {
  catalogSource: CatalogSource
  slug: string
  printifyProductId?: string | null
}): boolean {
  if (input.catalogSource === 'merch-store') return true
  if (input.printifyProductId?.trim() && BAKED_PRINTIFY_IDS.has(input.printifyProductId.trim())) {
    return true
  }
  return shopSlugHasBakedWordmarkPrint(input.slug)
}
