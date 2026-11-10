import { MerchPreviewFigure } from '@/features/merch/components/MerchPreviewFigure'
import { usePreviewOverlaysEnabled } from '@/features/merch/hooks/usePreviewOverlaysEnabled'
import type { ShirtColor } from '@/lib/merch/shirts/catalog'

type ShirtMockupFigureProps = {
  slug: string
  src: string
  alt: string
  width: number
  height: number
  shirtColor: ShirtColor
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
  className,
  priority,
  sizes = '(max-width: 1024px) 100vw, 480px',
  showOverlay = true,
}: ShirtMockupFigureProps) {
  const previewOn = usePreviewOverlaysEnabled() && showOverlay
  return (
    <MerchPreviewFigure
      showOverlay={previewOn}
      src={src}
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
