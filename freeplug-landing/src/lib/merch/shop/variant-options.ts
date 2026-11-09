import type { ShopVariant } from './types'

const SIZE_ORDER = ['XS', 'S', 'M', 'L', 'XL', '2XL', '3XL', '4XL', '5XL']

export function sortSizes(sizes: string[]): string[] {
  return [...sizes].sort((a, b) => {
    const ai = SIZE_ORDER.indexOf(a.toUpperCase())
    const bi = SIZE_ORDER.indexOf(b.toUpperCase())
    if (ai === -1 && bi === -1) return a.localeCompare(b)
    if (ai === -1) return 1
    if (bi === -1) return -1
    return ai - bi
  })
}

export function uniqueColors(variants: ShopVariant[]): string[] {
  const set = new Set<string>()
  for (const v of variants) {
    if (v.color) set.add(v.color)
  }
  return [...set].sort((a, b) => a.localeCompare(b))
}

export function sizesForColor(variants: ShopVariant[], color: string | null): string[] {
  const pool = color ? variants.filter((v) => v.color === color) : variants
  const set = new Set<string>()
  for (const v of pool) {
    if (v.size) set.add(v.size)
  }
  return sortSizes([...set])
}

export function resolveVariant(
  variants: ShopVariant[],
  opts: { color: string | null; size: string | null; variantId: number | null }
): ShopVariant | null {
  if (!variants.length) return null
  if (opts.variantId != null) {
    const byId = variants.find((v) => v.id === opts.variantId)
    if (byId) return byId
  }
  const { color, size } = opts
  const hit = variants.find((v) => {
    if (color && v.color !== color) return false
    if (size && v.size !== size) return false
    return true
  })
  return hit ?? variants[0] ?? null
}

export function pickerMode(variants: ShopVariant[]): 'color-size' | 'color-only' | 'size-only' | 'title' {
  const hasColor = variants.some((v) => v.color)
  const hasSize = variants.some((v) => v.size)
  if (hasColor && hasSize) return 'color-size'
  if (hasColor) return 'color-only'
  if (hasSize) return 'size-only'
  return 'title'
}
