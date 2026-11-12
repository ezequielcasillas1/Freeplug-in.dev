import { MerchPreviewFigure } from '@/features/merch/components/MerchPreviewFigure'
import { usePreviewOverlaysEnabled } from '@/features/merch/hooks/usePreviewOverlaysEnabled'
import type { ShirtColor } from '@/lib/merch/shirts/catalog'
import {
  shirtGarmentDisplayMockupSideFromPublicPath,
  shirtGarmentDisplayMockupSrc,
  shirtUsesDesignedSvgFront,
} from '@/lib/merch/shirts/shirt-display-mockup'

type ShirtMockupFigureProps = {
  slug: string
  src: string
  alt: string
  width: number
  height: number
  shirtColor: ShirtColor
  side?: 'front' | 'back'
  className?: string
  priority?: boolean
  sizes?: string
  showOverlay?: boolean
}

export function ShirtMockupFigure({
  slug,
  src,
  alt,
  width,
  height,
  shirtColor,
  side: sideProp,
  className,
  priority,
  sizes = '(max-width: 1024px) 100vw, 480px',
  showOverlay = true,
}: ShirtMockupFigureProps) {
  const layersOn = usePreviewOverlaysEnabled()
  const side = sideProp ?? shirtGarmentDisplayMockupSideFromPublicPath(src)
  const displaySrc = shirtGarmentDisplayMockupSrc(slug, shirtColor, side, { designedSvgFront: layersOn })
  const designedFrontArt = shirtUsesDesignedSvgFront(slug, side)
  const overlayOn = layersOn && (designedFrontArt || showOverlay)
  return (
    <MerchPreviewFigure
      showOverlay={overlayOn}
      src={displaySrc}
      alt={alt}
      width={width}
      height={height}
      className={className}
      priority={priority}
      sizes={sizes}
      preview={{
        source: 't-shirts',
        slug,
        href: `/merch/t-shirts/${slug}`,
        productType: 't-shirt',
        catalogKey: `tshirts/${slug}`,
        garmentColor: shirtColor,
      }}
    />
  )
}
