'use client'

import { CatalogCardImage } from '@/features/merch/components/CatalogCardImage'
import { CatalogPreviewWordmarkOverlay } from '@/features/merch/components/CatalogPreviewWordmarkOverlay'
import type { CatalogFilterItem } from '@/lib/merch/catalog-filter-types'
import { resolvePreviewWordmark } from '@/lib/merch/preview/preview-wordmark-resolve'

function slugFromCatalogKey(key: string): string {
  const slash = key.indexOf('/')
  return slash >= 0 ? key.slice(slash + 1) : key
}

export function CatalogCardWithPreview({
  item,
  sizes,
  showOverlay = true,
}: {
  item: CatalogFilterItem
  sizes: string
  showOverlay?: boolean
}) {
  const overlay = resolvePreviewWordmark({
    source: item.source,
    slug: slugFromCatalogKey(item.key),
    href: item.href,
    productType: item.productType,
    catalogKey: item.key,
    garmentColor: item.colors[0] ?? null,
  })

  return (
    <>
      <CatalogCardImage src={item.image} sizes={sizes} />
      {showOverlay && overlay ? <CatalogPreviewWordmarkOverlay config={overlay} /> : null}
    </>
  )
}
