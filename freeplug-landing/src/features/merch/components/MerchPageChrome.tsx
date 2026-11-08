'use client'

import type { ReactNode } from 'react'
import { Navigation } from '@/features/landing/components/Navigation'
import { Footer } from '@/features/landing/components/Footer'
import { MerchSecondaryNav } from './MerchSecondaryNav'

type Props = { children: ReactNode; showSubNav?: boolean }

export function MerchPageChrome({ children, showSubNav = true }: Props) {
  return (
    <>
      <Navigation />
      {/* Offset fixed site nav (h-16 / sm:h-20) so merch sub-nav and titles are not covered on load */}
      <div className="min-w-0 overflow-x-clip pt-16 sm:pt-20">
        {showSubNav ? <MerchSecondaryNav /> : null}
        {children}
      </div>
      <Footer />
    </>
  )
}
