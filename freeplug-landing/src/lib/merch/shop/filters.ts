import type { ShopCard } from './types'

export type ShopSort = 'featured' | 'price-asc' | 'price-desc'

export type ShopFilters = {
  minPriceCents?: number
  maxPriceCents?: number
  productType?: string
  color?: string
}

export function filterShopCards(cards: ShopCard[], filters: ShopFilters): ShopCard[] {
  return cards.filter((c) => {
    if (filters.minPriceCents != null && c.fromRetailCents < filters.minPriceCents) return false
    if (filters.maxPriceCents != null && c.fromRetailCents > filters.maxPriceCents) return false
    if (filters.productType && c.productType !== filters.productType) return false
    if (filters.color && !c.colors.some((col) => col.toLowerCase().includes(filters.color!.toLowerCase()))) return false
    return true
  })
}

export function sortShopCards(cards: ShopCard[], sort: ShopSort): ShopCard[] {
  const copy = [...cards]
  if (sort === 'price-asc') {
    copy.sort((a, b) => a.fromRetailCents - b.fromRetailCents)
  } else if (sort === 'price-desc') {
    copy.sort((a, b) => b.fromRetailCents - a.fromRetailCents)
  } else {
    copy.sort((a, b) => a.featuredRank - b.featuredRank)
  }
  return copy
}

export function uniqueProductTypes(cards: ShopCard[]): string[] {
  return [...new Set(cards.map((c) => c.productType))].sort()
}
