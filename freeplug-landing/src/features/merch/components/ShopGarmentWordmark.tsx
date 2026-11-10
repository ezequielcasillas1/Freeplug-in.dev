/** Vector garment wordmarks for buyer-shop mockup overlays (replaces low-res PNGs in UI). */

import { BrandWordmarkVariation } from '@/features/merch/components/BrandWordmarkVariation'
import type { ShirtColor } from '@/lib/merch/shirts/catalog'

export function ShopGarmentWordmark({
  variant,
  variationId,
  className,
}: {
  /** `dark` = light ink on dark blanks; `light` = dark ink on light blanks */
  variant: 'dark' | 'light'
  variationId: string
  className?: string
}) {
  const shirtColor: ShirtColor = variant === 'light' ? 'White' : 'Black'
  return <BrandWordmarkVariation variationId={variationId} shirtColor={shirtColor} className={className} />
}

export function isShopGarmentLogoPath(src: string | null | undefined): boolean {
  if (!src) return false
  return /\/merch\/shop\/freeplug-logo-(dark|light)-garment\.(png|svg)$/i.test(src)
}

export function garmentLogoVariant(src: string): 'dark' | 'light' {
  return src.includes('light-garment') ? 'light' : 'dark'
}
