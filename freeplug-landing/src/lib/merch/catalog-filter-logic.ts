import { normalizeSizeFacetKey, sizeFacetFilterMatches, uniqueSizeFacetKeys } from '@/lib/merch/catalog-size-facet'
import { SHOP_TABS, type ShopTabSlug } from '@/lib/merch/shop/types'
import {
  EMPTY_CATALOG_FILTER,
  type CatalogAvailability,
  type CatalogDesign,
  type CatalogFacets,
  type CatalogFilterItem,
  type CatalogFilterScope,
  type CatalogFilterState,
  type CatalogSort,
  type CatalogSource,
} from './catalog-filter-types'
import {
  isBrandNameKey,
  isWordmarkStyleGroup,
  matchesPreviewWordmarkCatalogFilters,
} from '@/lib/merch/preview/preview-wordmark-filter'

const ALL_SOURCES: CatalogSource[] = ['merch-store', 't-shirts', 'buyer-shop']
const ALL_AVAIL: CatalogAvailability[] = ['buyable', 'coming-soon', 'missing-mockup']
const ALL_DESIGNS: CatalogDesign[] = ['freeplug', 'custom']

export function applyCatalogFilters(items: CatalogFilterItem[], state: CatalogFilterState): CatalogFilterItem[] {
  return items.filter((item) => matchesCatalogFilter(item, state))
}

export function matchesCatalogFilter(item: CatalogFilterItem, state: CatalogFilterState): boolean {
  if (state.sources.length && item.source && !state.sources.includes(item.source)) return false
  if (state.categories.length && !state.categories.includes(item.category)) return false
  if (state.productTypes.length) {
    const pt = item.productType
    if (!pt || !state.productTypes.includes(pt)) return false
  }
  if (state.availability.length && !state.availability.some((a) => item.availability.includes(a))) return false
  if (state.minPriceCents != null && item.fromPriceCents < state.minPriceCents) return false
  if (state.maxPriceCents != null && item.fromPriceCents > state.maxPriceCents) return false
  if (state.colors.length && !state.colors.some((c) => item.colors.some((ic) => ic.toLowerCase() === c.toLowerCase()))) {
    return false
  }
  if (state.sizes.length && !sizeFacetFilterMatches(item.sizes, state.sizes)) return false
  if (state.designs.length && !state.designs.some((d) => item.designs.includes(d))) return false
  if (
    !matchesPreviewWordmarkCatalogFilters(
      item,
      state.supremeLookOnly,
      state.brandNameKeys,
      state.wordmarkStyleGroups
    )
  ) {
    return false
  }
  return true
}

export function sortCatalogItems(items: CatalogFilterItem[], sort: CatalogSort): CatalogFilterItem[] {
  const copy = [...items]
  if (sort === 'price-asc') {
    copy.sort((a, b) => a.fromPriceCents - b.fromPriceCents || a.sortName.localeCompare(b.sortName))
  } else if (sort === 'price-desc') {
    copy.sort((a, b) => b.fromPriceCents - a.fromPriceCents || a.sortName.localeCompare(b.sortName))
  } else if (sort === 'name-asc') {
    copy.sort((a, b) => a.sortName.localeCompare(b.sortName))
  } else {
    copy.sort((a, b) => a.featuredRank - b.featuredRank || a.sortName.localeCompare(b.sortName))
  }
  return copy
}

/** Facet counts for the current filter context (colors/sizes/types not applied). */
export function computePanelFacets(items: CatalogFilterItem[], state: CatalogFilterState): CatalogFacets {
  const relaxed: CatalogFilterState = { ...state, colors: [], sizes: [], productTypes: [] }
  return computeCatalogFacets(applyCatalogFilters(items, relaxed))
}

export function computeCatalogFacets(items: CatalogFilterItem[]): CatalogFacets {
  const sources = Object.fromEntries(ALL_SOURCES.map((s) => [s, 0])) as Record<CatalogSource, number>
  const categories = Object.fromEntries(SHOP_TABS.map((c) => [c, 0])) as Record<ShopTabSlug, number>
  const productTypes: Record<string, number> = {}
  const availability = Object.fromEntries(ALL_AVAIL.map((a) => [a, 0])) as Record<CatalogAvailability, number>
  const designs = Object.fromEntries(ALL_DESIGNS.map((d) => [d, 0])) as Record<CatalogDesign, number>
  const colors: Record<string, number> = {}
  const sizes: Record<string, number> = {}
  let priceMinCents = Infinity
  let priceMaxCents = 0

  for (const item of items) {
    if (item.source) sources[item.source] += 1
    categories[item.category] += 1
    if (item.productType) productTypes[item.productType] = (productTypes[item.productType] ?? 0) + 1
    for (const a of item.availability) availability[a] += 1
    for (const d of item.designs) designs[d] += 1
    for (const c of item.colors) {
      const key = c.trim()
      if (key) colors[key] = (colors[key] ?? 0) + 1
    }
    for (const key of uniqueSizeFacetKeys(item.sizes)) {
      sizes[key] = (sizes[key] ?? 0) + 1
    }
    priceMinCents = Math.min(priceMinCents, item.fromPriceCents)
    priceMaxCents = Math.max(priceMaxCents, item.fromPriceCents)
  }

  if (!items.length) {
    priceMinCents = 0
    priceMaxCents = 0
  }

  return {
    sources,
    categories,
    productTypes,
    availability,
    designs,
    colors,
    sizes,
    priceMinCents,
    priceMaxCents,
    total: items.length,
  }
}

export function facetKeysSorted(counts: Record<string, number>, limit = 80): string[] {
  return Object.entries(counts)
    .filter(([, n]) => n > 0)
    .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))
    .slice(0, limit)
    .map(([k]) => k)
}

export function catalogFilterIsActive(state: CatalogFilterState, scope: CatalogFilterScope): boolean {
  const base = { ...state }
  if (scope === 'shop' || scope === 't-shirts' || scope === 'collection') {
    base.sources = []
  }
  if (scope === 't-shirts' || scope === 'collection') {
    base.categories = []
    base.productTypes = []
    base.availability = []
    base.colors = []
    base.sizes = []
    base.designs = []
    base.minPriceCents = null
    base.maxPriceCents = null
  }
  return (
    base.sources.length > 0 ||
    base.categories.length > 0 ||
    base.productTypes.length > 0 ||
    base.availability.length > 0 ||
    base.colors.length > 0 ||
    base.sizes.length > 0 ||
    base.designs.length > 0 ||
    base.minPriceCents != null ||
    base.maxPriceCents != null ||
    base.sort !== 'featured' ||
    !base.previewOverlays ||
    base.supremeLookOnly ||
    base.brandNameKeys.length > 0 ||
    base.wordmarkStyleGroups.length > 0
  )
}

export function parseCatalogFilterSearchParams(
  params: URLSearchParams,
  scope: CatalogFilterScope
): CatalogFilterState {
  const state: CatalogFilterState = { ...EMPTY_CATALOG_FILTER, sort: 'featured' }

  const sort = params.get('sort')
  if (sort === 'price-asc' || sort === 'price-desc' || sort === 'name-asc' || sort === 'featured') {
    state.sort = sort
  }

  if (scope === 'all-merch') {
    state.sources = splitCsv(params.get('src')).filter(isSource)
  }
  state.categories = splitCsv(params.get('cat')).filter(isCategory)
  state.productTypes = splitCsv(params.get('pt'))
  state.availability = splitCsv(params.get('avail')).filter(isAvailability)
  state.colors = splitCsv(params.get('col'))
  state.sizes = splitCsv(params.get('sz')).map(normalizeSizeFacetKey).filter(Boolean)
  state.designs = splitCsv(params.get('design')).filter(isDesign)

  const min = parseInt(params.get('min') ?? '', 10)
  const max = parseInt(params.get('max') ?? '', 10)
  if (Number.isFinite(min) && min >= 0) state.minPriceCents = min
  if (Number.isFinite(max) && max >= 0) state.maxPriceCents = max

  const preview = params.get('preview')
  if (preview === '0' || preview === 'false') state.previewOverlays = false
  if (preview === '1' || preview === 'true') state.previewOverlays = true

  if (params.get('supreme') === '1' || params.get('style') === 'rectangular') state.supremeLookOnly = true

  state.brandNameKeys = splitCsv(params.get('name')).filter(isBrandNameKey)
  state.wordmarkStyleGroups = splitCsv(params.get('wstyle')).filter(isWordmarkStyleGroup)

  return state
}

export function catalogFilterToSearchParams(state: CatalogFilterState, scope: CatalogFilterScope): URLSearchParams {
  const q = new URLSearchParams()
  if (state.sort !== 'featured') q.set('sort', state.sort)
  if (scope === 'all-merch' && state.sources.length) q.set('src', state.sources.join(','))
  if (state.categories.length) q.set('cat', state.categories.join(','))
  if (state.productTypes.length) q.set('pt', state.productTypes.join(','))
  if (state.availability.length) q.set('avail', state.availability.join(','))
  if (state.colors.length) q.set('col', state.colors.join(','))
  if (state.sizes.length) q.set('sz', state.sizes.join(','))
  if (state.designs.length) q.set('design', state.designs.join(','))
  if (state.minPriceCents != null) q.set('min', String(state.minPriceCents))
  if (state.maxPriceCents != null) q.set('max', String(state.maxPriceCents))
  if (!state.previewOverlays) q.set('preview', '0')
  if (state.supremeLookOnly) q.set('supreme', '1')
  if (state.brandNameKeys.length) q.set('name', state.brandNameKeys.join(','))
  if (state.wordmarkStyleGroups.length) q.set('wstyle', state.wordmarkStyleGroups.join(','))
  return q
}

export function mergeCatalogFilterState(prev: CatalogFilterState, patch: Partial<CatalogFilterState>): CatalogFilterState {
  return { ...prev, ...patch }
}

function splitCsv(v: string | null): string[] {
  if (!v?.trim()) return []
  return v
    .split(',')
    .map((s) => decodeURIComponent(s.trim()))
    .filter(Boolean)
}

function isSource(v: string): v is CatalogSource {
  return (ALL_SOURCES as readonly string[]).includes(v)
}

function isCategory(v: string): v is ShopTabSlug {
  return (SHOP_TABS as readonly string[]).includes(v)
}

function isAvailability(v: string): v is CatalogAvailability {
  return (ALL_AVAIL as readonly string[]).includes(v)
}

function isDesign(v: string): v is CatalogDesign {
  return (ALL_DESIGNS as readonly string[]).includes(v)
}
