'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { useTranslations } from 'next-intl'
import { useLocale } from 'next-intl'
import { toAppLocale } from '@/i18n/config'
import { publicHref } from '@/i18n/routing'
import { cn } from '@/lib/utils/cn'
import {
  MERCH_FONT_BUNDLE_SLUG,
  MERCH_PERSONAL_USE_SLUG,
  MERCH_TSHIRTS_SLUG,
} from '@/lib/merch/product'

const TABS = [
  { slug: MERCH_TSHIRTS_SLUG, labelKey: 'subnav.tshirts' as const },
  { slug: MERCH_FONT_BUNDLE_SLUG, labelKey: 'subnav.officialFonts' as const },
  { slug: MERCH_PERSONAL_USE_SLUG, labelKey: 'subnav.personalUse' as const },
] as const

export function MerchSecondaryNav() {
  const t = useTranslations('public.merch')
  const locale = toAppLocale(useLocale())
  const pathname = usePathname() ?? ''
  const { path } = stripMerchPath(pathname)

  return (
    <nav
      aria-label={t('subnav.aria')}
      className="sticky top-16 sm:top-20 z-40 border-b border-gray-200 bg-white/95 backdrop-blur-md"
    >
      <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8">
        <ul className="flex gap-1 overflow-x-auto py-2 snap-x snap-mandatory scrollbar-thin -mx-1 px-1">
          {TABS.map((tab) => {
            const href = publicHref(`/merch/${tab.slug}`, locale)
            const active = path === `/merch/${tab.slug}`
            return (
              <li key={tab.slug} className="snap-start shrink-0">
                <Link
                  href={href}
                  className={cn(
                    'inline-flex items-center rounded-lg px-4 py-2 text-sm font-medium whitespace-nowrap transition-colors',
                    active
                      ? 'bg-[#ba3d3d]/10 text-[#ba3d3d]'
                      : 'text-gray-600 hover:bg-gray-100 hover:text-gray-900'
                  )}
                  aria-current={active ? 'page' : undefined}
                >
                  {t(tab.labelKey)}
                </Link>
              </li>
            )
          })}
        </ul>
      </div>
    </nav>
  )
}

function stripMerchPath(pathname: string): { path: string } {
  const m = /^\/(en|es)(\/.*)$/.exec(pathname)
  const path = m ? m[2] : pathname
  if (path === '/merch' || path.startsWith('/merch/')) return { path }
  return { path: '' }
}
