import { BuyerShopGridWordmarkOverlay } from '@/features/merch/components/BuyerShopGridWordmarkOverlay'
import { MerchMockupArtboard } from '@/features/merch/components/MerchMockupArtboard'
import type { CatalogFilterItem } from '@/lib/merch/catalog-filter-types'
import { resolvePreviewWordmark } from '@/lib/merch/preview/preview-wordmark-resolve'
import { blankKindForShopBlankSrc, resolveShopPreviewBlankKind } from '@/lib/merch/shop/shop-gallery-blank-kind'
import { isRemoteShopImage } from '@/lib/merch/shop/shop-listing-image'

function slugFromCatalogKey(key: string): string {
  const slash = key.indexOf('/')
  return slash >= 0 ? key.slice(slash + 1) : key
}

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
  const slug = slugFromCatalogKey(item.key)
  const shopPreviewItem =
    item.gallery?.length && item.galleryBlankKinds?.length
      ? { gallery: [...item.gallery], galleryBlankKinds: [...item.galleryBlankKinds] }
      : null
  const garmentBlankKind =
    shopPreviewItem && item.image
      ? (blankKindForShopBlankSrc(shopPreviewItem, item.image) ??
        resolveShopPreviewBlankKind({
          item: shopPreviewItem,
          garmentColor: item.colors[0] ?? null,
          displayImageSrc: item.image,
          galleryIndex: 0,
        }))
      : resolveShopPreviewBlankKind({
          garmentColor: item.colors[0] ?? null,
          displayImageSrc: item.image,
        })
  const overlay = resolvePreviewWordmark({
    source: item.source,
    slug,
    href: item.href,
    productType: item.productType,
    catalogKey: item.key,
    garmentColor: item.colors[0] ?? null,
    garmentBlankKind,
  })

  const src = item.image
  const remote = isRemoteShopImage(src)

  return (
    <MerchMockupArtboard
      className="absolute inset-0"
      contentInset="p-2"
      image={
        <div className="relative h-full w-full">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={src}
            alt=""
            width={1000}
            height={1000}
            loading="eager"
            decoding="async"
            fetchPriority="low"
            referrerPolicy={remote ? 'no-referrer' : undefined}
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
