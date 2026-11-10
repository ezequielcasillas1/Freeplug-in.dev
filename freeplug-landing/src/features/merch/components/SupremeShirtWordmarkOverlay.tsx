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

function SupremeWordmarkSvg({
  spec,
  shirtColor,
}: {
  spec: SupremePreviewSpec
  shirtColor: ShirtColor
}) {
  const visual = supremeWordmarkVisual(spec, shirtColor)
  const { placement, lines } = spec
  const cy = placement.top * 100
  const boxW = placement.width * 100
  const lineGap = placement.lineHeight
  const fontSize = lines.length >= 3 ? 5.4 : lines.length === 2 ? 6.2 : 7.4
  const lineStep = fontSize * lineGap
  const textBlockH = lines.length * lineStep
  const padY = visual.boxed ? 1.6 : 0
  const padX = visual.boxed ? 2.8 : 0
  const boxH = textBlockH + padY * 2
  const startY = -textBlockH / 2 + fontSize * 0.35

  return (
    <svg
      className="pointer-events-none absolute inset-0 z-[2] h-full w-full"
      viewBox="0 0 100 100"
      preserveAspectRatio="xMidYMid meet"
      aria-hidden
    >
      <g transform={`translate(50 ${cy})`}>
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

export function SupremeShirtWordmarkOverlay({
  slug,
  shirtColor,
  className,
}: {
  slug: string
  shirtColor: ShirtColor
  className?: string
}) {
  const spec = getSupremePreviewSpec(slug)
  if (!spec) return null

  return (
    <div className={cn('absolute inset-0', className)}>
      <SupremeWordmarkSvg spec={spec} shirtColor={shirtColor} />
    </div>
  )
}
