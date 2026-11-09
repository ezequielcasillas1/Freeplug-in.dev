import Image from 'next/image'
import { isRemoteShopImage } from '@/lib/merch/shop/shop-listing-image'

export function CatalogCardImage({ src, sizes, className = 'object-contain p-2' }: { src: string; sizes: string; className?: string }) {
  const remote = isRemoteShopImage(src)
  return (
    <>
      {remote ? (
        // eslint-disable-next-line @next/next/no-img-element -- Printify CDN; next/image remotePatterns stay empty
        <img src={src} alt="" loading="lazy" className={`absolute inset-0 w-full h-full ${className}`} />
      ) : (
        <Image src={src} alt="" fill unoptimized loading="lazy" className={className} sizes={sizes} />
      )}
    </>
  )
}
