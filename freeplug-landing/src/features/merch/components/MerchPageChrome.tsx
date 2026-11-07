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
      {showSubNav ? <MerchSecondaryNav /> : null}
      {children}
      <Footer />
    </>
  )
}
