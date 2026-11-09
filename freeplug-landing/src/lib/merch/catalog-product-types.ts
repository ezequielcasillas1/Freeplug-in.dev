import { listAllMerchItems } from '@/lib/merch/all-merch'

/** Every product-type slug used in the catalog filter UI. */
export function listCatalogProductTypeSlugs(): string[] {
  const slugs = new Set<string>()
  for (const item of listAllMerchItems()) {
    if (item.productType) slugs.add(item.productType)
  }
  return [...slugs].sort()
}
