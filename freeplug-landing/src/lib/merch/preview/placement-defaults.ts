/** Normalized overlay frame (0–1) on product mockup images. */
export type PreviewPlacement = {
  top: number
  left: number
  width: number
  scale?: number
  /** Degrees, clockwise; optional per-mockup adjustment */
  rotate?: number
}

export const PREVIEW_PLACEMENT_BY_PRODUCT_TYPE: Record<string, PreviewPlacement> = {
  't-shirt': { top: 0.54, left: 0.5, width: 0.34 },
  tee: { top: 0.54, left: 0.5, width: 0.34 },
  hoodie: { top: 0.47, left: 0.5, width: 0.31 },
  sweatshirt: { top: 0.49, left: 0.5, width: 0.31 },
  'long-sleeve': { top: 0.52, left: 0.5, width: 0.32 },
  tank: { top: 0.51, left: 0.5, width: 0.3 },
  hat: { top: 0.58, left: 0.5, width: 0.26 },
  mug: { top: 0.44, left: 0.5, width: 0.24 },
  drinkware: { top: 0.44, left: 0.5, width: 0.24 },
  bag: { top: 0.41, left: 0.5, width: 0.28 },
  bags: { top: 0.41, left: 0.5, width: 0.28 },
  sticker: { top: 0.5, left: 0.5, width: 0.32 },
  'stickers-&-paper': { top: 0.5, left: 0.5, width: 0.32 },
  poster: { top: 0.36, left: 0.5, width: 0.38 },
  'wall-art': { top: 0.34, left: 0.5, width: 0.36 },
  canvas: { top: 0.32, left: 0.5, width: 0.34 },
  'home-&-decor': { top: 0.4, left: 0.5, width: 0.28 },
  'tech-&-desk': { top: 0.43, left: 0.5, width: 0.26 },
  pets: { top: 0.45, left: 0.5, width: 0.28 },
  'kids-&-baby': { top: 0.48, left: 0.5, width: 0.29 },
  'outdoor-&-seasonal': { top: 0.44, left: 0.5, width: 0.28 },
  'jewelry-&-pins': { top: 0.52, left: 0.5, width: 0.2 },
  'socks-&-shoes': { top: 0.46, left: 0.5, width: 0.24 },
  apparel: { top: 0.5, left: 0.5, width: 0.3 },
  crewneck: { top: 0.49, left: 0.5, width: 0.31 },
  collection: { top: 0.45, left: 0.5, width: 0.3 },
  default: { top: 0.46, left: 0.5, width: 0.3 },
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
