import type { ShirtColor } from '@/lib/merch/shirts/catalog'
import { shirtMockupPublicPath } from '@/lib/merch/shirts/catalog'
import { isSupremeStyleShirtSlug } from '@/lib/merch/shirts/supreme-preview'

/** Front mockup with baked Supreme slogan removed (generated under public/merch/shirts). */
export function supremeBlankFrontMockupPath(slug: string, color: ShirtColor): string {
  return `/merch/shirts/${slug}-${color.toLowerCase()}-blank-front.jpg`
}

export function shirtFrontMockupForPreview(
  slug: string,
  color: ShirtColor,
  opts: { useBlankSupreme: boolean }
): string {
  if (opts.useBlankSupreme && isSupremeStyleShirtSlug(slug)) {
    return supremeBlankFrontMockupPath(slug, color)
  }
  return shirtMockupPublicPath(slug, color, 'front')
}
