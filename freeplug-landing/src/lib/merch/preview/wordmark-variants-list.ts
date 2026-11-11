import collections from '@/lib/merch/collections/collections-catalog.json'
import { listShopItems } from '@/lib/merch/shop/catalog'
import {
  DEFAULT_BUYER_WORDMARK_BRAND,
  buyerWordmarkBrandLabel,
} from './buyer-wordmark-brand'
import { isWordmarkBakedInPrintify } from './wordmark-baked-fulfillment'

export type WordmarkVariantsListRow = {
  productName: string
  catalogSource: 'buyer-shop' | 'merch-store'
  slug: string
  urlPath: string
  defaultWordmark: string
  wordmarkBakedInPrintify: boolean
}

export function listPlainGarmentsWordmarkVariants(): WordmarkVariantsListRow[] {
  const rows: WordmarkVariantsListRow[] = []
  const defaultLabel = buyerWordmarkBrandLabel(DEFAULT_BUYER_WORDMARK_BRAND)

  for (const item of listShopItems()) {
    rows.push({
      productName: item.title,
      catalogSource: 'buyer-shop',
      slug: item.slug,
      urlPath: `/shop/${item.slug}`,
      defaultWordmark: defaultLabel,
      wordmarkBakedInPrintify: isWordmarkBakedInPrintify({
        catalogSource: 'buyer-shop',
        slug: item.slug,
      }),
    })
  }

  for (const entry of collections) {
    rows.push({
      productName: entry.title,
      catalogSource: 'merch-store',
      slug: entry.slug,
      urlPath: `/merch/${entry.collection}/${entry.slug}`,
      defaultWordmark: defaultLabel,
      wordmarkBakedInPrintify: isWordmarkBakedInPrintify({
        catalogSource: 'merch-store',
        slug: entry.slug,
        printifyProductId: entry.printify_product_id,
      }),
    })
  }

  rows.sort((a, b) =>
    a.catalogSource === b.catalogSource
      ? a.slug.localeCompare(b.slug)
      : a.catalogSource.localeCompare(b.catalogSource)
  )
  return rows
}

function csvEscape(value: string): string {
  if (/[",\n]/.test(value)) return `"${value.replace(/"/g, '""')}"`
  return value
}

export function wordmarkVariantsListToCsv(rows: WordmarkVariantsListRow[]): string {
  const header = [
    'product_name',
    'catalog_source',
    'slug',
    'url_path',
    'default_wordmark',
    'wordmark_baked_in_printify',
  ]
  const lines = [header.join(',')]
  for (const row of rows) {
    lines.push(
      [
        csvEscape(row.productName),
        row.catalogSource,
        row.slug,
        row.urlPath,
        csvEscape(row.defaultWordmark),
        row.wordmarkBakedInPrintify ? 'yes' : 'no',
      ].join(',')
    )
  }
  return `${lines.join('\n')}\n`
}

export type WordmarkVariantsListSummary = {
  total: number
  buyerShop: number
  merchStore: number
  bakedInPrintify: number
  swappableAtFulfillment: number
}

export function summarizeWordmarkVariantsList(rows: WordmarkVariantsListRow[]): WordmarkVariantsListSummary {
  const buyerShop = rows.filter((r) => r.catalogSource === 'buyer-shop').length
  const merchStore = rows.filter((r) => r.catalogSource === 'merch-store').length
  const bakedInPrintify = rows.filter((r) => r.wordmarkBakedInPrintify).length
  return {
    total: rows.length,
    buyerShop,
    merchStore,
    bakedInPrintify,
    swappableAtFulfillment: rows.length - bakedInPrintify,
  }
}
