'use client'

import Image from 'next/image'
import { cn } from '@/lib/utils/cn'

export function ShopMockupPreview({
  productSrc,
  logoSrc,
  customSrc,
  placement = { x: 0.5, y: 0.42, scale: 0.38 },
  alt,
  className,
}: {
  productSrc: string
  logoSrc?: string | null
  customSrc?: string | null
  placement?: { x: number; y: number; scale: number }
  alt: string
  className?: string
}) {
  const overlaySrc = customSrc || logoSrc
  const widthPct = `${placement.scale * 55}%`

  return (
    <div className={cn('relative w-full aspect-square rounded-2xl bg-zinc-100 overflow-hidden', className)}>
      <Image
        src={productSrc}
        alt={alt}
        fill
        unoptimized
        className="object-contain"
        sizes="(max-width: 768px) 100vw, 480px"
      />
      {overlaySrc ? (
        <div
          className="pointer-events-none absolute"
          style={{
            left: `${placement.x * 100}%`,
            top: `${placement.y * 100}%`,
            width: widthPct,
            transform: 'translate(-50%, -50%)',
          }}
        >
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={overlaySrc} alt="" className="w-full h-auto drop-shadow-sm" />
        </div>
      ) : null}
    </div>
  )
}
