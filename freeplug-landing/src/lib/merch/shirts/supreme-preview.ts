import { getWordmarkVariation } from '@/lib/merch/preview/wordmark-variations'
import type { PreviewPlacement } from '@/lib/merch/preview/placement-defaults'
import specs from './supreme-preview-specs.json'
import type { ShirtColor } from './catalog'

export type SupremePreviewSpec = {
  slug: string
  lines: string[]
  style: 'boxed' | 'plain'
  ink: 'white-on-black-box' | 'white-on-charcoal-box'
  /** Baked Printify slogan box on the JPEG (left = left edge, top = vertical center). */
  placement: { top: number; left: number; width: number; lineHeight: number }
  bakedLineCount?: number
  /** Buyer-shop garment map only — not used on catalog tee heroes. */
  variationId?: string
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

/** Normalized coords on 1200×1200 mockup; left = center x of badge (0–1). */
const SLOGAN_TEE_CHEST_LEFT_DEFAULT: PreviewPlacement = {
  left: 0.61,
  top: 0.305,
  width: 0.12,
}

/** Per-tee nudge (higher / more toward collar) when main art sits high on the chest. */
const SLOGAN_TEE_CHEST_LEFT_BY_SLUG: Partial<Record<string, Partial<PreviewPlacement>>> = {
  '11-init-open-hand-give': { top: 0.285, left: 0.6 },
  '12-init-bridge-the-gap': { top: 0.288, left: 0.59 },
  '14-init-plug-in-kindness': { top: 0.292, left: 0.61 },
  '16-init-running-over': { top: 0.29, left: 0.605 },
  '18-init-charge-forward-care': { top: 0.288, left: 0.608 },
  '19-init-house-of-help': { top: 0.3, left: 0.615, width: 0.11 },
  '21-world-stay-charged': { top: 0.282, left: 0.598 },
  '24-world-day-one': { top: 0.286, left: 0.595, width: 0.11 },
  '25-world-free-refills': { top: 0.284, left: 0.602 },
  '26-world-senses-alive': { top: 0.278, left: 0.585, width: 0.11 },
  '28-world-taste-the-charge': { top: 0.286, left: 0.608 },
  '29-world-sound-on': { top: 0.284, width: 0.11 },
}

/**
 * Slogan tees (11–30): small assigned treatment on the wearer's left chest — original artwork unchanged.
 * `spec.placement` remains the baked slogan box (documentation only).
 */
export function supremeWordmarkPlacement(spec: SupremePreviewSpec): PreviewPlacement {
  const patch = SLOGAN_TEE_CHEST_LEFT_BY_SLUG[spec.slug] ?? {}
  const variationId = spec.variationId
  const def = variationId ? getWordmarkVariation(variationId) : null
  const compact = def?.treatment === 'wide-stretched' || def?.treatment === 'wide-tracking-caps'
  return {
    ...SLOGAN_TEE_CHEST_LEFT_DEFAULT,
    ...patch,
    width: patch.width ?? (compact ? 0.11 : SLOGAN_TEE_CHEST_LEFT_DEFAULT.width),
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
