import {
  buyerWordmarkArtPublicPath,
  parseBuyerWordmarkVariationId,
} from '@/lib/merch/preview/buyer-wordmark-art-paths'
import { getBrandNameLabel } from '@/lib/merch/preview/brand-names'
import {
  MOCKUP_NORMALIZED_SIZE,
  placementToSvgPoint,
  wordmarkScaleFromPlacement,
  wordmarkUsesCompactLayout,
} from '@/lib/merch/preview/preview-overlay-layout'
import type { ResolvedPreviewWordmark } from '@/lib/merch/preview/preview-wordmark-resolve'
import { getWordmarkVariation } from '@/lib/merch/preview/wordmark-variations'
import { cn } from '@/lib/utils/cn'

/** Server-safe buyer-shop raster overlay (no client bundle required for grid mockups). */
export function BuyerShopGridWordmarkOverlay({
  config,
  className,
}: {
  config: ResolvedPreviewWordmark
  className?: string
}) {
  if (config.mode === 'skip') return null
  const { placement } = config
  const { cx, cy } = placementToSvgPoint(placement)
  const scale = wordmarkScaleFromPlacement(placement)
  const def = getWordmarkVariation(config.variationId)
  const parsed = parseBuyerWordmarkVariationId(config.variationId)
  if (!parsed) return null
  const labelLen = def ? getBrandNameLabel(def.nameKey).length : 12
  const compact = config.chestBadge === true || wordmarkUsesCompactLayout(placement.width, labelLen)
  const src = buyerWordmarkArtPublicPath(parsed.style, parsed.brand, config.blankKind)
  const w = compact ? 56 : 76
  const h = compact ? 15 : 20

  return (
    <svg
      className={cn('h-full w-full overflow-visible', className)}
      viewBox={`0 0 ${MOCKUP_NORMALIZED_SIZE} ${MOCKUP_NORMALIZED_SIZE}`}
      preserveAspectRatio="xMidYMid meet"
      aria-hidden
    >
      <g transform={`translate(${cx} ${cy}) scale(${scale})`}>
        <image href={src} x={-w / 2} y={-h / 2} width={w} height={h} preserveAspectRatio="xMidYMid meet" />
      </g>
    </svg>
  )
}
