import Image from 'next/image'
import { SupremeShirtWordmarkOverlay } from '@/features/merch/components/SupremeShirtWordmarkOverlay'
import { isSupremeStyleShirtSlug } from '@/lib/merch/shirts/supreme-preview'
import type { ShirtColor } from '@/lib/merch/shirts/catalog'
import { cn } from '@/lib/utils/cn'

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
}: ShirtMockupFigureProps) {
  const supreme = isSupremeStyleShirtSlug(slug)

  return (
    <figure
      className={cn('relative rounded-2xl border border-gray-200 bg-white overflow-hidden', className)}
    >
      <Image
        src={src}
        alt={alt}
        width={width}
        height={height}
        unoptimized
        priority={priority}
        sizes={sizes}
        className="block w-full h-auto max-w-full object-contain"
      />
      {supreme ? <SupremeShirtWordmarkOverlay slug={slug} shirtColor={shirtColor} /> : null}
    </figure>
  )
}
