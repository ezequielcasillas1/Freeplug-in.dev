'use client'

import { ShirtMockupFigure } from '@/features/merch/components/ShirtMockupFigure'
import { usePreviewOverlaysEnabled } from '@/features/merch/hooks/usePreviewOverlaysEnabled'
import type { ShirtColor } from '@/lib/merch/shirts/catalog'
import { shirtGarmentDisplayMockupSrc } from '@/lib/merch/shirts/shirt-display-mockup'

/** PDP + grid share identical hero mockup props (only `sizes` / `priority` / `className` differ). */
export function ShirtHeroMockup({
  slug,
  shirtColor,
  side = 'front',
  alt,
  priority,
  sizes,
  showOverlay = true,
  className,
}: {
  slug: string
  shirtColor: ShirtColor
  side?: 'front' | 'back'
  alt: string
  priority?: boolean
  sizes?: string
  showOverlay?: boolean
  className?: string
}) {
  const layersOn = usePreviewOverlaysEnabled()
  const src = shirtGarmentDisplayMockupSrc(slug, shirtColor, side, { designedSvgFront: layersOn })

  return (
    <ShirtMockupFigure
      slug={slug}
      src={src}
      shirtColor={shirtColor}
      side={side}
      alt={alt}
      width={1000}
      height={1200}
      priority={priority}
      sizes={sizes}
      showOverlay={showOverlay}
      className={className}
    />
  )
}
