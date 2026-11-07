'use client'

import Link from 'next/link'
import { ArrowRight } from 'lucide-react'
import { Navigation } from './Navigation'
import { Footer } from './Footer'
import { CompareTable } from './CompareTable'
import { useLocale, useTranslations } from 'next-intl'
import { toAppLocale } from '@/i18n/config'
import { publicHref } from '@/i18n/routing'

export function ComparePageView() {
  const t = useTranslations('public.compare')
  const locale = toAppLocale(useLocale())

  return (
    <>
      <Navigation />
      <main className="min-h-screen bg-gradient-to-b from-white to-zinc-50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-16 sm:py-24">
          <nav className="text-sm text-gray-500 mb-6" aria-label="Breadcrumb">
            <Link href={publicHref('/', locale)} className="hover:text-[#ba3d3d]">
              {t('breadcrumbHome')}
            </Link>
            <span className="mx-2">/</span>
            <span className="text-gray-800">{t('breadcrumbCompare')}</span>
          </nav>
          <h1 className="text-3xl sm:text-4xl md:text-5xl font-bold text-gray-900 mb-4">{t('h1')}</h1>
          <p className="text-lg text-gray-600 max-w-3xl mb-4">{t('ownHeading')}</p>
          <p className="text-sm text-gray-500 max-w-3xl mb-10">{t('compareDescription')}</p>
          <CompareTable />
          <p className="text-sm text-gray-500 mt-8 max-w-3xl">{t('footnote')}</p>
          <div className="mt-10 flex flex-wrap gap-4">
            <Link
              href={publicHref('/#hosting-plans', locale)}
              className="inline-flex items-center gap-2 rounded-lg bg-[#ba3d3d] text-white px-6 py-3 font-semibold hover:bg-[#a33535]"
            >
              {t('seePricing')}
            </Link>
            <Link
              href={publicHref('/request-website', locale)}
              className="inline-flex items-center gap-2 text-[#ba3d3d] font-semibold hover:underline"
            >
              {t('requestForm')}
              <ArrowRight size={18} aria-hidden />
            </Link>
            <Link href={publicHref('/', locale)} className="text-gray-600 hover:text-[#ba3d3d] text-sm font-medium">
              {t('homeLink')}
            </Link>
          </div>
        </div>
      </main>
      <Footer />
    </>
  )
}
