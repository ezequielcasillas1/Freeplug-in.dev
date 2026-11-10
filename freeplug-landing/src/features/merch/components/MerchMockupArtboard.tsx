import type { ReactNode } from 'react'
import { cn } from '@/lib/utils/cn'

/**
 * Shared coordinate system for Printify mockups: image and SVG overlay use the same
 * inset so placement math matches the chest (not the card padding).
 */
export function MerchMockupArtboard({
  image,
  overlay,
  className,
  contentInset = '',
}: {
  image: ReactNode
  overlay?: ReactNode
  className?: string
  /** Tailwind inset matching the image (e.g. `p-2`). */
  contentInset?: string
}) {
  return (
    <div className={cn('relative h-full w-full', className)}>
      <div className={cn('absolute inset-0', contentInset)}>{image}</div>
      {overlay ? (
        <div className={cn('pointer-events-none absolute inset-0 z-[2]', contentInset)} aria-hidden>
          {overlay}
        </div>
      ) : null}
    </div>
  )
}
