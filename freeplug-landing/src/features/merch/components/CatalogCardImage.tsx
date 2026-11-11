import { isRemoteShopImage } from '@/lib/merch/shop/shop-listing-image'

export function CatalogCardImage({ src, sizes, className = 'object-contain p-2' }: { src: string; sizes: string; className?: string }) {
  const remote = isRemoteShopImage(src)
  const localBlank = src.startsWith('/merch/shop/blanks/')
  if (remote || localBlank) {
    return (
      // eslint-disable-next-line @next/next/no-img-element -- grid must render without client hydration
      <img
        src={src}
        alt=""
        loading="eager"
        decoding="async"
        className={`absolute inset-0 h-full w-full ${className}`}
        sizes={sizes}
      />
    )
  }
  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img src={src} alt="" loading="eager" decoding="async" className={`absolute inset-0 h-full w-full ${className}`} sizes={sizes} />
  )
}
