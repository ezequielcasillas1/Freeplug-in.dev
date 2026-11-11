'use client'

import type { ReactNode } from 'react'
import { cn } from '@/lib/utils/cn'

/** Toggles wordmark overlay visibility while keeping the server-rendered garment photo mounted. */
export function ShopGridCardFrame({
  mockup,
  showOverlay,
}: {
  mockup: ReactNode
  showOverlay: boolean
}) {
  return (
    <div className={cn('h-full w-full', !showOverlay && '[&_svg]:opacity-0 [&_svg]:pointer-events-none')}>
      {mockup}
    </div>
  )
}
