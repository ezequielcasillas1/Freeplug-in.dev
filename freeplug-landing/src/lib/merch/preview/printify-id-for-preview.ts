import printifyProducts from '@/lib/merch/shop/printify-products.json'
import shirtsCatalog from '@/lib/merch/shirts/shirts-catalog.json'
import collectionsCatalog from '@/lib/merch/collections/collections-catalog.json'
import type { CatalogSource } from '@/lib/merch/catalog-filter-types'

const shirtList = (Array.isArray(shirtsCatalog) ? shirtsCatalog : []) as { slug: string; printify_product_id: string }[]
const shirtIdBySlug = new Map(shirtList.map((p) => [p.slug, p.printify_product_id]))
const collectionIdBySlug = new Map(collectionsCatalog.map((p) => [p.slug, p.printify_product_id]))

type PrintifyDb = {
  bySlug: Record<string, { printifyProductId: string | null }>
}

const shopDb = printifyProducts as PrintifyDb

/** Resolves the storefront’s primary Printify product id for preview policy. */
export function printifyProductIdForPreview(input: {
  source: CatalogSource | null
  slug: string
  catalogKey: string
}): string | null {
  if (input.source === 'buyer-shop') {
    return shopDb.bySlug[input.slug]?.printifyProductId?.trim() || null
  }
  if (input.source === 't-shirts') {
    return shirtIdBySlug.get(input.slug)?.trim() || null
  }
  if (input.source === 'merch-store') {
    return collectionIdBySlug.get(input.slug)?.trim() || null
  }
  return null
}
