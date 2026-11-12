import { shirtMockupPublicPath, type ShirtColor } from '@/lib/merch/shirts/catalog'
import { isSupremeStyleShirtSlug } from '@/lib/merch/shirts/supreme-preview'

/** Init/world rectangular tees: baked Printify *-front.jpg only (live PDP has no slogan SVG). */
export function shirtUsesDesignedSvgFront(slug: string, side: 'front' | 'back'): boolean {
  return side === 'front' && isSupremeStyleShirtSlug(slug)
}

/** Single source for grid cards, PDP hero, and filter thumbnails (front/back). */
export function shirtGarmentDisplayMockupSrc(
  slug: string,
  color: ShirtColor,
  side: 'front' | 'back'
): string {
  return shirtMockupPublicPath(slug, color, side)
}

export function shirtGarmentDisplayMockupSideFromPublicPath(src: string): 'front' | 'back' {
  return /-back\.(jpg|webp|png)/i.test(src) ? 'back' : 'front'
}
