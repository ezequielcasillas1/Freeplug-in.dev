'use client'

import { usePathname } from 'next/navigation'
import { TranslationNotice } from '@/components/i18n/TranslationNotice'

/** Checkout pages: Aria's card says the legal line NEVER shows there (translation-notice.test.tsx). */
export const NO_NOTICE_PREFIXES = ['/dashboard/plans'] as const

/** Spanish dashboard: Aria's legal line, once, in the footer (TranslationNotice renders only in es). */
export function DashboardFooter() {
  const pathname = usePathname() ?? ''
  if (NO_NOTICE_PREFIXES.some((p) => pathname === p || pathname.startsWith(p + '/'))) return null
  return (
    <footer className="max-w-5xl mx-auto px-4 sm:px-6 pb-10">
      <TranslationNotice className="text-center text-gray-500" />
    </footer>
  )
}
