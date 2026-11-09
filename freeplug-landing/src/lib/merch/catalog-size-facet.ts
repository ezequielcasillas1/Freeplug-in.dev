/** Canonical facet id for one-size products (filter URL + facet counts). */
export const CATALOG_SIZE_FACET_ONE_SIZE = 'one-size'

const ONE_SIZE_ALIASES = new Set([
  'one size',
  'one-size',
  'onesize',
  'one size fits all',
  'one-size-fits-all',
  'osfa',
  'os',
  'o/s',
  'o s',
  '1 size',
  'single size',
  'talla unica',
  'talla única',
])

function normalizeToken(input: string): string {
  return input.trim().toLowerCase().replace(/_/g, '-').replace(/\s+/g, ' ').trim()
}

function isOneSizeAlias(normalized: string): boolean {
  const asWords = normalized.replace(/-/g, ' ')
  return ONE_SIZE_ALIASES.has(normalized) || ONE_SIZE_ALIASES.has(asWords)
}

function normalizeLetterSize(part: string): string {
  const p = part.trim()
  if (!p) return p
  if (isOneSizeAlias(normalizeToken(p))) return CATALOG_SIZE_FACET_ONE_SIZE
  if (/^\d+xl$/i.test(p)) return p.toUpperCase()
  if (/^(xx?s|xxx?l|s|m|l|xl)$/i.test(p)) return p.toUpperCase()
  return p
}

/**
 * Collapse size variants for catalog filters (e.g. OSFA → one-size, s/m → S/M).
 */
export function normalizeSizeFacetKey(raw: string): string {
  const trimmed = raw.trim()
  if (!trimmed) return ''
  const token = normalizeToken(trimmed)
  if (isOneSizeAlias(token)) return CATALOG_SIZE_FACET_ONE_SIZE

  const split = trimmed.split(/[/-]/).map((s) => s.trim()).filter(Boolean)
  if (split.length > 1) {
  const normalized = split.map((part) => normalizeLetterSize(part))
    if (normalized.every(Boolean)) return normalized.join('/')
  }

  return normalizeLetterSize(trimmed)
}

export function uniqueSizeFacetKeys(sizes: readonly string[]): string[] {
  const keys = new Set<string>()
  for (const s of sizes) {
    const key = normalizeSizeFacetKey(s)
    if (key) keys.add(key)
  }
  return [...keys]
}

export function sizeFacetFilterMatches(itemSizes: readonly string[], selected: readonly string[]): boolean {
  if (!selected.length) return true
  const itemKeys = new Set(itemSizes.map(normalizeSizeFacetKey))
  const want = new Set(selected.map(normalizeSizeFacetKey))
  for (const w of want) {
    if (itemKeys.has(w)) return true
  }
  return false
}
