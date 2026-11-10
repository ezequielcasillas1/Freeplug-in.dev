'use client'

import { BrandWordmarkGraphic } from '@/features/merch/components/BrandWordmarkVariation'
import type { ResolvedPreviewWordmark } from '@/lib/merch/preview/preview-wordmark-resolve'
import { shirtColorFromBlank } from '@/lib/merch/preview/preview-wordmark-resolve'
import { cn } from '@/lib/utils/cn'

export function CatalogPreviewWordmarkOverlay({
  config,
  className,
}: {
  config: ResolvedPreviewWordmark
  className?: string
}) {
  if (config.mode === 'skip') return null
  const shirtColor = shirtColorFromBlank(config.blankKind)
  const { placement } = config
  const cx = placement.left * 100
  const cy = placement.top * 100
  const scale = placement.scale ?? placement.width * 2.65

  return (
    <div className={cn('pointer-events-none absolute inset-0 z-[2]', className)}>
      <svg className="absolute inset-0 h-full w-full" viewBox="0 0 100 100" preserveAspectRatio="xMidYMid meet" aria-hidden>
        <g transform={`translate(${cx} ${cy}) scale(${scale})`}>
          <BrandWordmarkGraphic variationId={config.variationId} shirtColor={shirtColor} />
        </g>
      </svg>
    </div>
  )
}
