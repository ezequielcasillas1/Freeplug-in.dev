'use client'

import { CatalogPreviewWordmarkOverlay } from '@/features/merch/components/CatalogPreviewWordmarkOverlay'
import { MerchMockupArtboard } from '@/features/merch/components/MerchMockupArtboard'
import type { ShopGridMockupProps } from '@/lib/merch/shop/shop-grid-mockup-props'

/** Grid card mockup from server-serialized props (lightweight vs 195 RSC element trees). */
export function ShopGridCardFromProps({
  props,
  showOverlay,
}: {
  props: ShopGridMockupProps
  showOverlay: boolean
}) {
  return (
    <MerchMockupArtboard
      className="absolute inset-0"
      contentInset="p-2"
      image={
        <div className="relative h-full w-full">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={props.imageSrc}
            alt=""
            width={1000}
            height={1000}
            loading="eager"
            decoding="sync"
            referrerPolicy={props.remoteImage ? 'no-referrer' : undefined}
            className="h-full w-full object-contain"
          />
        </div>
      }
      overlay={
        showOverlay && props.overlay ? (
          <CatalogPreviewWordmarkOverlay config={props.overlay} />
        ) : undefined
      }
    />
  )
}
