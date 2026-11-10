'use client'

import { WordmarkTreatmentArt, wordmarkInkForBlank } from '@/features/merch/components/WordmarkTreatmentArt'
import { getWordmarkVariation } from '@/lib/merch/preview/wordmark-variations'
import type { ShirtColor } from '@/lib/merch/shirts/catalog'

export function wordmarkInkForShirt(shirtColor: ShirtColor) {
  const blank = shirtColor === 'White' || shirtColor === 'Natural' ? 'light' : 'dark'
  return wordmarkInkForBlank(blank)
}

export function BrandWordmarkGraphic({
  variationId,
  shirtColor,
}: {
  variationId: string
  shirtColor: ShirtColor
}) {
  const def = getWordmarkVariation(variationId)
  if (!def) return null
  const blank = shirtColor === 'White' || shirtColor === 'Natural' ? 'light' : 'dark'
  const ink = wordmarkInkForBlank(blank)
  return <WordmarkTreatmentArt treatment={def.treatment} nameKey={def.nameKey} ink={ink} />
}

export function BrandWordmarkVariation({
  variationId,
  shirtColor,
  className,
  compact,
}: {
  variationId: string
  shirtColor: ShirtColor
  className?: string
  compact?: boolean
}) {
  const def = getWordmarkVariation(variationId)
  if (!def) return null
  const blank = shirtColor === 'White' || shirtColor === 'Natural' ? 'light' : 'dark'
  const ink = wordmarkInkForBlank(blank)
  return (
    <svg className={className} viewBox="-50 -22 100 44" preserveAspectRatio="xMidYMid meet" aria-hidden role="presentation">
      <WordmarkTreatmentArt treatment={def.treatment} nameKey={def.nameKey} ink={ink} compact={compact} />
    </svg>
  )
}

export function BrandWordmarkContactTile({
  variationId,
  variant = 'dark-shirt',
}: {
  variationId: string
  variant?: 'dark-shirt' | 'light-shirt'
}) {
  const def = getWordmarkVariation(variationId)
  if (!def) return null
  const shirtColor: ShirtColor = variant === 'light-shirt' ? 'White' : 'Black'
  return (
    <figure className="rounded-xl border border-zinc-200 bg-zinc-50 p-3 flex flex-col items-center gap-1.5 min-h-[150px]">
      <BrandWordmarkVariation variationId={variationId} shirtColor={shirtColor} className="w-full h-20" />
      <figcaption className="text-[10px] font-mono text-zinc-500 text-center leading-tight">{variationId}</figcaption>
      <p className="text-sm font-semibold text-zinc-900 text-center">{def.treatmentLabel}</p>
      <p className="text-xs text-zinc-600 text-center">{def.nameKey.replace(/-/g, '.')}</p>
    </figure>
  )
}
