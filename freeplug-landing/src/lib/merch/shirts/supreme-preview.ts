import { getWordmarkVariation } from '@/lib/merch/preview/wordmark-variations'
import type { PreviewPlacement } from '@/lib/merch/preview/placement-defaults'
import specs from './supreme-preview-specs.json'
import type { ShirtColor } from './catalog'

export type SupremePreviewSpec = {
  slug: string
  variationId: string
  style: 'boxed' | 'plain'
  ink: 'white-on-black-box' | 'white-on-charcoal-box'
  /** Baked Printify slogan box on the JPEG (left = left edge, top = vertical center). */
  placement: { top: number; left: number; width: number; lineHeight: number }
  bakedLineCount?: number
}

const bySlug = new Map((specs as SupremePreviewSpec[]).map((s) => [s.slug, s]))

export function getSupremePreviewSpec(slug: string): SupremePreviewSpec | null {
  return bySlug.get(slug) ?? null
}

export function isSupremeStyleShirtSlug(slug: string): boolean {
  return bySlug.has(slug)
}

export function getSupremeVariationId(slug: string): string | null {
  return bySlug.get(slug)?.variationId ?? null
}

/** @deprecated use getSupremeVariationId */
export function getSupremeWordmarkId(slug: string): string | null {
  return getSupremeVariationId(slug)
}

export function listSupremePreviewSpecs(): SupremePreviewSpec[] {
  return specs as SupremePreviewSpec[]
}

const WORDMARK_TOP_BY_SLUG: Partial<Record<string, number>> = {
  '11-init-open-hand-give': 0.448,
  '12-init-bridge-the-gap': 0.442,
  '16-init-running-over': 0.446,
  '18-init-charge-forward-care': 0.444,
  '25-world-free-refills': 0.446,
  '21-world-stay-charged': 0.45,
  '28-world-taste-the-charge': 0.448,
}

/** Centered chest brand preview — separate from the baked slogan box coordinates. */
export function supremeWordmarkPlacement(spec: SupremePreviewSpec): PreviewPlacement {
  const def = getWordmarkVariation(spec.variationId)
  const chestLeft = def?.treatment === 'chest-left-mini-box'
  return {
    left: chestLeft ? 0.44 : 0.5,
    top: WORDMARK_TOP_BY_SLUG[spec.slug] ?? 0.452,
    width: chestLeft ? 0.22 : 0.27,
  }
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
