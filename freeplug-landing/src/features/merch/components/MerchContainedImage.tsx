import Image from 'next/image'
import { cn } from '@/lib/utils/cn'

type MerchContainedImageProps = {
  src: string
  alt: string
  width: number
  height: number
  className?: string
  priority?: boolean
  sizes?: string
}

/** Full-width merch figures: scale down without cropping on mobile. */
export function MerchContainedImage({
  src,
  alt,
  width,
  height,
  className,
  priority,
  sizes = '(max-width: 1024px) 100vw, 480px',
}: MerchContainedImageProps) {
  return (
    <figure className={cn('rounded-2xl border border-gray-200 bg-white overflow-hidden', className)}>
      <Image
        src={src}
        alt={alt}
        width={width}
        height={height}
        unoptimized
        priority={priority}
        sizes={sizes}
        className="block w-full h-auto max-w-full object-contain"
      />
    </figure>
  )
}
