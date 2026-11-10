/** Normalized overlay frame (0–1) on product mockup images. */
export type PreviewPlacement = {
  top: number
  left: number
  width: number
  scale?: number
}

export const PREVIEW_PLACEMENT_BY_PRODUCT_TYPE: Record<string, PreviewPlacement> = {
  't-shirt': { top: 0.54, left: 0.5, width: 0.34, scale: 2.65 },
  tee: { top: 0.54, left: 0.5, width: 0.34, scale: 2.65 },
  hoodie: { top: 0.47, left: 0.5, width: 0.31, scale: 2.45 },
  sweatshirt: { top: 0.49, left: 0.5, width: 0.31, scale: 2.45 },
  'long-sleeve': { top: 0.52, left: 0.5, width: 0.32, scale: 2.5 },
  tank: { top: 0.51, left: 0.5, width: 0.3, scale: 2.4 },
  hat: { top: 0.58, left: 0.5, width: 0.26, scale: 2.2 },
  mug: { top: 0.44, left: 0.5, width: 0.24, scale: 2.0 },
  drinkware: { top: 0.44, left: 0.5, width: 0.24, scale: 2.0 },
  bag: { top: 0.41, left: 0.5, width: 0.28, scale: 2.35 },
  bags: { top: 0.41, left: 0.5, width: 0.28, scale: 2.35 },
  sticker: { top: 0.5, left: 0.5, width: 0.32, scale: 2.5 },
  'stickers-&-paper': { top: 0.5, left: 0.5, width: 0.32, scale: 2.5 },
  poster: { top: 0.36, left: 0.5, width: 0.38, scale: 2.8 },
  'wall-art': { top: 0.34, left: 0.5, width: 0.36, scale: 2.7 },
  canvas: { top: 0.32, left: 0.5, width: 0.34, scale: 2.6 },
  'home-&-decor': { top: 0.4, left: 0.5, width: 0.28, scale: 2.3 },
  'tech-&-desk': { top: 0.43, left: 0.5, width: 0.26, scale: 2.15 },
  pets: { top: 0.45, left: 0.5, width: 0.28, scale: 2.25 },
  'kids-&-baby': { top: 0.48, left: 0.5, width: 0.29, scale: 2.3 },
  'outdoor-&-seasonal': { top: 0.44, left: 0.5, width: 0.28, scale: 2.25 },
  'jewelry-&-pins': { top: 0.52, left: 0.5, width: 0.2, scale: 1.85 },
  'socks-&-shoes': { top: 0.46, left: 0.5, width: 0.24, scale: 2.1 },
  apparel: { top: 0.5, left: 0.5, width: 0.3, scale: 2.4 },
  crewneck: { top: 0.49, left: 0.5, width: 0.31, scale: 2.45 },
  collection: { top: 0.45, left: 0.5, width: 0.3, scale: 2.35 },
  default: { top: 0.46, left: 0.5, width: 0.3, scale: 2.35 },
}

const COLLECTION_SLUG_TO_TYPE: Record<string, string> = {
  drinkware: 'mug',
  hats: 'hat',
  apparel: 'apparel',
  'bags-accessories': 'bag',
  'kids-baby': 'kids-&-baby',
  pets: 'pets',
  'home-living': 'home-&-decor',
  'home-faith': 'home-&-decor',
  'desk-extras': 'tech-&-desk',
  'wall-art': 'wall-art',
  outdoor: 'outdoor-&-seasonal',
}

export function inferProductTypeFromCatalog(slug: string, productType: string | null, catalogKey: string): string {
  if (slug === 'hero-crewneck') return 'crewneck'
  if (/canvas/i.test(slug)) return 'canvas'
  if (/mug|tumbler/i.test(slug)) return 'mug'
  if (/poster|print/i.test(slug)) return 'poster'
  if (/sticker/i.test(slug)) return 'sticker'
  if (/hat|cap|beanie/i.test(slug)) return 'hat'
  if (/hoodie/i.test(slug)) return 'hoodie'
  const collectionPrefix = catalogKey.split('/')[0]
  if (collectionPrefix && COLLECTION_SLUG_TO_TYPE[collectionPrefix]) {
    return COLLECTION_SLUG_TO_TYPE[collectionPrefix]!
  }
  return productType ?? 'collection'
}

export function placementForProductType(productType: string | null | undefined): PreviewPlacement {
  if (!productType) return PREVIEW_PLACEMENT_BY_PRODUCT_TYPE.default!
  const key = productType.toLowerCase()
  return PREVIEW_PLACEMENT_BY_PRODUCT_TYPE[key] ?? PREVIEW_PLACEMENT_BY_PRODUCT_TYPE.default!
}
