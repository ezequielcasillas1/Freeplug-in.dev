'use client'

import { getSupremePreviewSpec } from '@/lib/merch/shirts/supreme-preview'
import type { ShirtColor } from '@/lib/merch/shirts/catalog'
import {
  FONT_STACK,
  supremeSloganFabricFill,
  supremeSloganStripLayout,
} from '@/lib/merch/shirts/supreme-slogan-strip'
import { cn } from '@/lib/utils/cn'

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

  const layout = supremeSloganStripLayout(spec, shirtColor)
  const fabricFill = supremeSloganFabricFill(shirtColor)

  return (
    <div className={cn('absolute inset-0', className)} aria-hidden>
      <svg
        className="pointer-events-none absolute inset-0 z-[2] h-full w-full overflow-visible"
        viewBox="0 0 100 100"
        preserveAspectRatio="xMidYMid meet"
        aria-hidden
        data-testid="designed-tee-slogan-overlay"
        data-print-max-w={layout.printMaxW.toFixed(2)}
        data-strip-w={layout.stripW.toFixed(2)}
        data-strip-h={layout.stripH.toFixed(2)}
      >
        <g transform={`translate(${layout.centerX} ${layout.centerY})`}>
          <rect
            x={-layout.stripW / 2}
            y={-layout.stripH / 2}
            width={layout.stripW}
            height={layout.stripH}
            fill={fabricFill}
            data-testid="designed-tee-slogan-fabric-patch"
          />
          {layout.boxed ? (
            <rect
              x={-layout.stripW / 2}
              y={-layout.stripH / 2}
              width={layout.stripW}
              height={layout.stripH}
              fill={layout.boxBg}
              data-testid="designed-tee-slogan-box"
            />
          ) : null}
          {layout.lines.map((line, i) => (
            <text
              key={`${line}-${i}`}
              x={0}
              y={layout.startY + i * layout.lineStep}
              fill={layout.textColor}
              fontFamily={FONT_STACK}
              fontWeight={700}
              fontSize={layout.fontSize}
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
    </div>
  )
}
