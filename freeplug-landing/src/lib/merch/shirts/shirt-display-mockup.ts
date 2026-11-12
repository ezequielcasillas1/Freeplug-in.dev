import { shirtMockupPublicPath, type ShirtColor } from '@/lib/merch/shirts/catalog'
import { isSupremeStyleShirtSlug } from '@/lib/merch/shirts/supreme-preview'

/** Init/world rectangular slogan tees: full art on *-front.jpg + live slogan SVG (not *-blank-front patch). */
export function shirtUsesDesignedSvgFront(slug: string, side: 'front' | 'back'): boolean {
  return side === 'front' && isSupremeStyleShirtSlug(slug)
}

/** Single source for grid cards, PDP hero, and filter thumbnails (front/back). */
export function shirtGarmentDisplayMockupSrc(
  slug: string,
  color: ShirtColor,
  side: 'front' | 'back',
  _opts?: { designedSvgFront?: boolean }
): string {
  return shirtMockupPublicPath(slug, color, side)
}

export function shirtGarmentDisplayMockupSideFromPublicPath(src: string): 'front' | 'back' {
  return /-(?:blank-)?back\.jpg$/i.test(src) ? 'back' : 'front'
}
