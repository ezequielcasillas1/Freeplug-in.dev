import type { ShirtColor } from '@/lib/merch/shirts/catalog'
import { shirtMockupPublicPath } from '@/lib/merch/shirts/catalog'
import { isSupremeStyleShirtSlug } from '@/lib/merch/shirts/supreme-preview'

/** @deprecated Cheke Nov 10 — do not use in preview UI; files kept in repo only. */
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
