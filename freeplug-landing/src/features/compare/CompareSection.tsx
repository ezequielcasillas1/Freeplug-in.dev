import { useLocale, useTranslations } from 'next-intl'
import { publicHref } from '@/i18n/routing'
import { toAppLocale } from '@/i18n/config'
import { HOME_COMPARE_GROUPS } from '@/lib/compare/data'
import { CompareTable } from './CompareTable'
import { HashRescroll } from './HashRescroll'

/** Home page short compare block (#compare): Freeplug + rent-to-own, links to /compare (Lina, Oct 31). */
export function CompareSection() {
  const t = useTranslations('public.compare')
  const locale = toAppLocale(useLocale())
  return (
    <section aria-labelledby="compare" data-section="compare" className="py-16 sm:py-24 bg-zinc-50 border-y border-zinc-200/80">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="text-center mb-10 sm:mb-12">
          {/* Anchor on the heading (Lina, Oct 31): /#compare lands the heading ~20px under the sticky header (64px / 80px from sm). */}
          <h2 id="compare" className="scroll-mt-[84px] sm:scroll-mt-[100px] text-3xl sm:text-4xl font-bold text-gray-900 mb-4">{t('heading')}</h2>
          <p className="text-lg text-gray-600 max-w-3xl mx-auto">{t('subline')}</p>
        </div>
        <HashRescroll id="compare" />
        <CompareTable groups={HOME_COMPARE_GROUPS} />
        <p className="mt-6 text-center text-sm text-gray-500">{t('footnote')}</p>
        <p className="mt-4 text-center">
          <a href={publicHref('/compare', locale)} className="text-sm font-semibold text-[#ba3d3d] hover:underline" data-testid="compare-full-link">
            {t('homeLink')} →
          </a>
        </p>
      </div>
    </section>
  )
}
