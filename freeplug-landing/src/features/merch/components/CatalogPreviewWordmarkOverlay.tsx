'use client'

import { BrandWordmarkGraphic } from '@/features/merch/components/BrandWordmarkVariation'
import { getBrandNameLabel } from '@/lib/merch/preview/brand-names'
import type { ResolvedPreviewWordmark } from '@/lib/merch/preview/preview-wordmark-resolve'
import {
  MOCKUP_NORMALIZED_SIZE,
  placementToSvgPoint,
  wordmarkScaleFromPlacement,
  wordmarkUsesCompactLayout,
} from '@/lib/merch/preview/preview-overlay-layout'
import { shirtColorFromBlank } from '@/lib/merch/preview/preview-wordmark-resolve'
import { getWordmarkVariation } from '@/lib/merch/preview/wordmark-variations'
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
  const { cx, cy } = placementToSvgPoint(placement)
  const scale = wordmarkScaleFromPlacement(placement)
  const def = getWordmarkVariation(config.variationId)
  const labelLen = def ? getBrandNameLabel(def.nameKey).length : 12
  const compact = wordmarkUsesCompactLayout(placement.width, labelLen)

  const mask = config.bakedPrintMask

  return (
    <svg
      className={cn('h-full w-full overflow-visible', className)}
      viewBox={`0 0 ${MOCKUP_NORMALIZED_SIZE} ${MOCKUP_NORMALIZED_SIZE}`}
      preserveAspectRatio="xMidYMid meet"
      aria-hidden
    >
      {mask ? (
        <rect
          x={(mask.left - mask.width / 2) * MOCKUP_NORMALIZED_SIZE}
          y={(mask.top - mask.height / 2) * MOCKUP_NORMALIZED_SIZE}
          width={mask.width * MOCKUP_NORMALIZED_SIZE}
          height={mask.height * MOCKUP_NORMALIZED_SIZE}
          fill={mask.fill}
          rx={mask.width * MOCKUP_NORMALIZED_SIZE * 0.04}
        />
      ) : null}
      <g transform={`translate(${cx} ${cy}) scale(${scale})`}>
        <BrandWordmarkGraphic variationId={config.variationId} shirtColor={shirtColor} compact={compact} />
      </g>
    </svg>
  )
}
