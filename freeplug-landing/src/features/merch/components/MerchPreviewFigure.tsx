'use client'

import Image from 'next/image'
import { CatalogPreviewWordmarkOverlay } from '@/features/merch/components/CatalogPreviewWordmarkOverlay'
import {
  resolvePreviewWordmark,
  type ResolvePreviewWordmarkInput,
} from '@/lib/merch/preview/preview-wordmark-resolve'
import { cn } from '@/lib/utils/cn'

type MerchPreviewFigureProps = {
  src: string
  alt: string
  width: number
  height: number
  className?: string
  priority?: boolean
  sizes?: string
  showOverlay?: boolean
  preview: Omit<ResolvePreviewWordmarkInput, 'garmentColor'> & { garmentColor?: string | null }
}

export function MerchPreviewFigure({
  src,
  alt,
  width,
  height,
  className,
  priority,
  sizes = '(max-width: 1024px) 100vw, 480px',
  showOverlay = true,
  preview,
}: MerchPreviewFigureProps) {
  const overlay = showOverlay
    ? resolvePreviewWordmark({
        ...preview,
        garmentColor: preview.garmentColor ?? null,
      })
    : null

  return (
    <figure className={cn('relative rounded-2xl border border-gray-200 bg-white overflow-hidden', className)}>
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
      {overlay ? <CatalogPreviewWordmarkOverlay config={overlay} /> : null}
    </figure>
  )
}
