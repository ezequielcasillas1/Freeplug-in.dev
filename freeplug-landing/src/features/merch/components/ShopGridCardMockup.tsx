import { BuyerShopGridWordmarkOverlay } from '@/features/merch/components/BuyerShopGridWordmarkOverlay'
import { MerchMockupArtboard } from '@/features/merch/components/MerchMockupArtboard'
import type { CatalogFilterItem } from '@/lib/merch/catalog-filter-types'
import { shopGridMockupPropsForItem } from '@/lib/merch/shop/shop-grid-mockup-props'

/**
 * SSR shop grid mockup: garment `<img>` + one wordmark. Rendered on the server so Cloudflare
 * pages include product photos without waiting on client hydration.
 */
export function ShopGridCardMockup({
  item,
  showOverlay = true,
}: {
  item: CatalogFilterItem
  showOverlay?: boolean
}) {
  const { imageSrc, overlay, remoteImage } = shopGridMockupPropsForItem(item)

  return (
    <MerchMockupArtboard
      className="absolute inset-0"
      contentInset="p-2"
      image={
        <div className="relative h-full w-full">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={imageSrc}
            alt=""
            width={1000}
            height={1000}
            loading="eager"
            decoding="async"
            fetchPriority="low"
            referrerPolicy={remoteImage ? 'no-referrer' : undefined}
            className="h-full w-full object-contain"
          />
        </div>
      }
      overlay={
        showOverlay && overlay ? <BuyerShopGridWordmarkOverlay config={overlay} /> : undefined
      }
    />
  )
}
