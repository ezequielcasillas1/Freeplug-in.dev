export const BRAND_NAME_KEYS = [
  'freeplug-in-dev',
  'freeplug',
  'freeplugin',
  'freeplug-dev',
  'freeplug-in',
  'fplgn',
] as const

export type BrandNameKey = (typeof BRAND_NAME_KEYS)[number]

export const BRAND_NAME_LABELS: Record<BrandNameKey, string> = {
  'freeplug-in-dev': 'Freeplug-in.dev',
  freeplug: 'Freeplug',
  freeplugin: 'Freeplugin',
  'freeplug-dev': 'Freeplug.dev',
  'freeplug-in': 'Freeplug.in',
  fplgn: 'FPLGN',
}

export function getBrandNameLabel(key: BrandNameKey): string {
  return BRAND_NAME_LABELS[key]
}
