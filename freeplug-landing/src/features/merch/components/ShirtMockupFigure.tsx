import { MerchPreviewFigure } from '@/features/merch/components/MerchPreviewFigure'
import { usePreviewOverlaysEnabled } from '@/features/merch/hooks/usePreviewOverlaysEnabled'
import type { ShirtColor } from '@/lib/merch/shirts/catalog'
import { isSupremeStyleShirtSlug } from '@/lib/merch/shirts/supreme-preview'
import { shirtFrontMockupForPreview } from '@/lib/merch/shirts/supreme-blank-mockup'

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
  const useBlank = previewOn && isSupremeStyleShirtSlug(slug)
  const resolvedSrc = useBlank
    ? shirtFrontMockupForPreview(slug, shirtColor, { useBlankSupreme: true })
    : src
  return (
    <MerchPreviewFigure
      showOverlay={previewOn}
      src={resolvedSrc}
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
