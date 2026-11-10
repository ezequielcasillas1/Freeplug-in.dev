'use client'

import Image from 'next/image'
import {
  garmentLogoVariant,
  isShopGarmentLogoPath,
  ShopGarmentWordmark,
} from '@/features/merch/components/ShopGarmentWordmark'
import type { ShopPrintArea } from '@/lib/merch/shop/types'
import { cn } from '@/lib/utils/cn'

export function ShopMockupPreview({
  productSrc,
  logoSrc,
  customSrc,
  printArea,
  placement = { x: 0.5, y: 0.42, scale: 0.38 },
  alt,
  className,
}: {
  productSrc: string
  logoSrc?: string | null
  customSrc?: string | null
  printArea?: ShopPrintArea
  placement?: { x: number; y: number; scale: number }
  alt: string
  className?: string
}) {
  const vectorGarmentLogo = isShopGarmentLogoPath(logoSrc) && !customSrc
  const overlaySrc = customSrc || (vectorGarmentLogo ? null : logoSrc)
  const aspect = printArea && printArea.height > 0 ? printArea.width / printArea.height : 1
  const widthPct = `${placement.scale * 55 * Math.min(1.25, Math.max(0.75, aspect))}%`
  const remoteProduct = /^https?:\/\//i.test(productSrc)

  return (
    <div className={cn('relative w-full aspect-square rounded-2xl bg-zinc-100 overflow-hidden', className)}>
      {remoteProduct ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={productSrc} alt={alt} className="absolute inset-0 w-full h-full object-contain" />
      ) : (
        <Image
          src={productSrc}
          alt={alt}
          fill
          unoptimized
          className="object-contain"
          sizes="(max-width: 768px) 100vw, 480px"
        />
      )}
      {vectorGarmentLogo && logoSrc ? (
        <div
          className="pointer-events-none absolute"
          style={{
            left: `${placement.x * 100}%`,
            top: `${placement.y * 100}%`,
            width: widthPct,
            transform: 'translate(-50%, -50%)',
          }}
        >
          <ShopGarmentWordmark
            variant={garmentLogoVariant(logoSrc)}
            className="block h-auto w-full [image-rendering:-webkit-optimize-contrast]"
          />
        </div>
      ) : null}
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
          <img
            src={overlaySrc}
            alt=""
            className="h-auto w-full"
            style={{ imageRendering: '-webkit-optimize-contrast' }}
          />
        </div>
      ) : null}
    </div>
  )
}
