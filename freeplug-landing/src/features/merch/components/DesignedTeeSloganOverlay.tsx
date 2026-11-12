'use client'

import {
  getSupremePreviewSpec,
  supremeWordmarkVisual,
  type SupremePreviewSpec,
} from '@/lib/merch/shirts/supreme-preview'
import type { ShirtColor } from '@/lib/merch/shirts/catalog'
import { cn } from '@/lib/utils/cn'

const FONT_STACK =
  "'Freeplug Dispatch Condensed', 'Arial Narrow', 'Helvetica Neue', Arial, sans-serif"

function SloganSvg({
  spec,
  shirtColor,
}: {
  spec: SupremePreviewSpec
  shirtColor: ShirtColor
}) {
  const visual = supremeWordmarkVisual(spec, shirtColor)
  const { placement, lines } = spec
  const centerX = (placement.left + placement.width / 2) * 100
  const cy = placement.top * 100
  const boxW = placement.width * 100
  const lineGap = placement.lineHeight
  const longest = Math.max(...lines.map((line) => line.length))
  const baseFont =
    lines.length >= 3 ? 5.2 : lines.length === 2 ? 6 : longest > 20 ? 4.6 : longest > 14 ? 5.4 : 7
  const fontSize = Math.min(baseFont, (boxW * 0.92) / (longest * 0.62))
  const lineStep = fontSize * lineGap
  const textBlockH = lines.length * lineStep
  const padY = visual.boxed ? 1.6 : 0
  const padX = visual.boxed ? 2.8 : 0
  const boxH = textBlockH + padY * 2
  const startY = -textBlockH / 2 + fontSize * 0.35

  return (
    <svg
      className="pointer-events-none absolute inset-0 z-[2] h-full w-full overflow-visible"
      viewBox="0 0 100 100"
      preserveAspectRatio="xMidYMid meet"
      aria-hidden
      data-testid="designed-tee-slogan-overlay"
    >
      <g transform={`translate(${centerX} ${cy})`}>
        {visual.boxed ? (
          <rect
            x={-boxW / 2 - padX}
            y={-boxH / 2}
            width={boxW + padX * 2}
            height={boxH}
            fill={visual.boxBg}
          />
        ) : null}
        {lines.map((line, i) => (
          <text
            key={`${line}-${i}`}
            x={0}
            y={startY + i * lineStep}
            fill={visual.textColor}
            fontFamily={FONT_STACK}
            fontWeight={700}
            fontSize={fontSize}
            textAnchor="middle"
            dominantBaseline="alphabetic"
            style={{ textRendering: 'geometricPrecision' }}
            letterSpacing="0.14em"
          >
            {line}
          </text>
        ))}
      </g>
    </svg>
  )
}

export function DesignedTeeSloganOverlay({
  slug,
  shirtColor,
  className,
}: {
  slug: string
  shirtColor: ShirtColor
  className?: string
}) {
  const spec = getSupremePreviewSpec(slug)
  if (!spec?.lines?.length) return null

  return (
    <div className={cn('absolute inset-0', className)} aria-hidden>
      <SloganSvg spec={spec} shirtColor={shirtColor} />
    </div>
  )
}
