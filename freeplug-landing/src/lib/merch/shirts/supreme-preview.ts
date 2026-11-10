import specs from './supreme-preview-specs.json'
import type { ShirtColor } from './catalog'

export type SupremePreviewSpec = {
  slug: string
  lines: string[]
  style: 'boxed' | 'plain'
  ink: 'white-on-black-box' | 'white-on-charcoal-box'
  placement: { top: number; left: number; width: number; lineHeight: number }
}

const bySlug = new Map((specs as SupremePreviewSpec[]).map((s) => [s.slug, s]))

export function getSupremePreviewSpec(slug: string): SupremePreviewSpec | null {
  return bySlug.get(slug) ?? null
}

export function isSupremeStyleShirtSlug(slug: string): boolean {
  return bySlug.has(slug)
}

export type SupremeWordmarkVisual = {
  boxed: boolean
  boxBg: string
  textColor: string
}

/** Specs were aligned on black mockups; light blanks use plain dark ink without a filled box. */
export function supremeWordmarkVisual(spec: SupremePreviewSpec, shirtColor: ShirtColor): SupremeWordmarkVisual {
  const lightGarment = shirtColor === 'White' || shirtColor === 'Natural'
  if (lightGarment) {
    return { boxed: false, boxBg: 'transparent', textColor: '#171717' }
  }
  if (spec.ink === 'white-on-black-box') {
    return { boxed: true, boxBg: '#0a0a0a', textColor: '#ffffff' }
  }
  return { boxed: true, boxBg: '#454545', textColor: '#ffffff' }
}
