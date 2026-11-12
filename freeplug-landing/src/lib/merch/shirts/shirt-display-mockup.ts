import { shirtMockupPublicPath, type ShirtColor } from '@/lib/merch/shirts/catalog'
import { supremeBlankFrontMockupPath } from '@/lib/merch/shirts/supreme-blank-mockup'
import { isSupremeStyleShirtSlug } from '@/lib/merch/shirts/supreme-preview'

/** Init/world rectangular wordmark tees: crisp SVG on blank-front (not baked Printify chest raster). */
export function shirtUsesDesignedSvgFront(slug: string, side: 'front' | 'back'): boolean {
  return side === 'front' && isSupremeStyleShirtSlug(slug)
}

/** Single source for grid cards, PDP hero, and filter thumbnails (front/back). */
export function shirtGarmentDisplayMockupSrc(
  slug: string,
  color: ShirtColor,
  side: 'front' | 'back',
  opts?: { designedSvgFront?: boolean }
): string {
  const useDesigned = opts?.designedSvgFront !== false && shirtUsesDesignedSvgFront(slug, side)
  if (useDesigned) return supremeBlankFrontMockupPath(slug, color)
  return shirtMockupPublicPath(slug, color, side)
}

export function shirtGarmentDisplayMockupSideFromPublicPath(src: string): 'front' | 'back' {
  return /-(?:blank-)?back\.jpg$/i.test(src) ? 'back' : 'front'
}
