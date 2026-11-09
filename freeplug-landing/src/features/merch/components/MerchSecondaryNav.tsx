'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { useTranslations } from 'next-intl'
import { useLocale } from 'next-intl'
import { ChevronRight } from 'lucide-react'
import { useCallback, useEffect, useRef, useState } from 'react'
import { toAppLocale } from '@/i18n/config'
import { publicHref } from '@/i18n/routing'
import { cn } from '@/lib/utils/cn'
import {
  MERCH_FONT_BUNDLE_SLUG,
  MERCH_PERSONAL_USE_SLUG,
  MERCH_TSHIRTS_SLUG,
} from '@/lib/merch/product'
import { MERCH_COLLECTIONS, type MerchCollectionSlug } from '@/lib/merch/collections/catalog'

const FONT_TABS = [
  { slug: MERCH_TSHIRTS_SLUG, labelKey: 'subnav.tshirts' as const },
  { slug: MERCH_FONT_BUNDLE_SLUG, labelKey: 'subnav.officialFonts' as const },
  { slug: MERCH_PERSONAL_USE_SLUG, labelKey: 'subnav.personalUse' as const },
] as const

const COLLECTION_TABS: { slug: MerchCollectionSlug; labelKey: `subnav.collections.${MerchCollectionSlug}` }[] =
  MERCH_COLLECTIONS.map((collection) => ({
    slug: collection,
    labelKey: `subnav.collections.${collection}`,
  }))

export function MerchSecondaryNav() {
  const t = useTranslations('public.merch')
  const locale = toAppLocale(useLocale())
  const pathname = usePathname() ?? ''
  const { path } = stripMerchPath(pathname)
  const listRef = useRef<HTMLUListElement>(null)
  const [scrollHint, setScrollHint] = useState(false)

  const updateScrollHint = useCallback(() => {
    const el = listRef.current
    if (!el) return
    const overflow = el.scrollWidth > el.clientWidth + 2
    const atEnd = el.scrollLeft + el.clientWidth >= el.scrollWidth - 4
    setScrollHint(overflow && !atEnd)
  }, [])

  useEffect(() => {
    const el = listRef.current
    if (!el) return
    el.addEventListener('scroll', updateScrollHint, { passive: true })
    const ro = new ResizeObserver(() => updateScrollHint())
    ro.observe(el)
    return () => {
      el.removeEventListener('scroll', updateScrollHint)
      ro.disconnect()
    }
  }, [updateScrollHint, pathname])

  return (
    <nav
      aria-label={t('subnav.aria')}
      className="sticky top-16 sm:top-20 z-40 border-b border-gray-200 bg-white/95 backdrop-blur-md"
    >
      <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 min-w-0">
        <div className="relative min-w-0">
          <ul
            ref={listRef}
            className="flex w-full min-w-0 gap-2 overflow-x-auto overscroll-x-contain py-2 pl-0.5 pr-14 snap-x snap-mandatory scroll-px-4 [-ms-overflow-style:none] [scrollbar-width:thin] [&::-webkit-scrollbar]:h-1.5 max-lg:scroll-smooth"
          >
            {[...FONT_TABS, ...COLLECTION_TABS].map((tab) => {
              const href = publicHref(`/merch/${tab.slug}`, locale)
              const base = `/merch/${tab.slug}`
              const active = path === base || path.startsWith(`${base}/`)
              return (
                <li key={tab.slug} className="snap-start shrink-0">
                  <Link
                    href={href}
                    className={cn(
                      'inline-flex items-center justify-center rounded-lg px-3 sm:px-4 min-h-11 min-w-[44px] text-sm font-medium whitespace-nowrap transition-colors',
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
          {scrollHint ? (
            <div
              className="pointer-events-none absolute inset-y-0 right-0 flex w-16 items-center justify-end gap-0.5 bg-gradient-to-l from-white from-20% via-white/95 to-transparent pr-1 max-lg:flex lg:hidden"
              aria-hidden
            >
              <span className="text-[10px] font-medium text-gray-400 hidden min-[360px]:inline">More</span>
              <ChevronRight className="h-5 w-5 text-[#ba3d3d]/70" strokeWidth={2.5} />
            </div>
          ) : null}
        </div>
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
