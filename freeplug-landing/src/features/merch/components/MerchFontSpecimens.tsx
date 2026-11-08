'use client'

import { motion } from 'framer-motion'
import { fadeInUp } from '@/features/landing/animations/landing.variants'
import { useTranslations } from 'next-intl'

/** Live type samples on the paid bundle page (basic-Latin preview fonts only). */
export function MerchFontSpecimens() {
  const t = useTranslations('public.merch')

  return (
    <motion.section variants={fadeInUp} className="mb-10 space-y-4" aria-labelledby="merch-font-specimens-heading">
      <h2 id="merch-font-specimens-heading" className="text-xl font-bold text-gray-900">
        {t('specimensHeading')}
      </h2>
      <div className="grid gap-4 sm:grid-cols-1 min-w-0">
        <div className="min-w-0 rounded-2xl border border-gray-200 bg-white p-4 sm:p-5" data-testid="merch-specimen-cursive">
          <p className="text-xs font-medium uppercase tracking-wide text-gray-500 mb-2">{t('specimenCursiveLabel')}</p>
          <p className="merch-specimen-cursive merch-specimen-display text-gray-900">{t('specimenCursiveLine')}</p>
          <p className="merch-specimen-cursive merch-specimen-phrase text-gray-800 mt-2">{t('specimenCursivePhrase')}</p>
        </div>
        <div className="min-w-0 rounded-2xl border border-gray-200 bg-white p-4 sm:p-5" data-testid="merch-specimen-dispatch">
          <p className="text-xs font-medium uppercase tracking-wide text-gray-500 mb-2">{t('specimenDispatchLabel')}</p>
          <p className="merch-specimen-dispatch-bold merch-specimen-display text-gray-900 tracking-tight">{t('specimenDispatchHeadline')}</p>
          <p className="merch-specimen-dispatch merch-specimen-phrase text-gray-800 mt-3">{t('specimenDispatchPhraseLeft')}</p>
          <p className="merch-specimen-dispatch-condensed merch-specimen-phrase-sm text-gray-700 mt-1">{t('specimenDispatchPhraseRight')}</p>
        </div>
        <div className="min-w-0 rounded-2xl border border-gray-200 bg-white p-4 sm:p-5" data-testid="merch-specimen-extended">
          <p className="text-xs font-medium uppercase tracking-wide text-gray-500 mb-2">{t('specimenExtendedLabel')}</p>
          <p className="merch-specimen-extended merch-specimen-display text-gray-900 tracking-tight">{t('specimenExtendedHeadline')}</p>
          <p className="merch-specimen-extended merch-specimen-phrase text-gray-800 mt-3">{t('specimenExtendedPhrase')}</p>
        </div>
      </div>
      <p className="text-xs text-gray-500">{t('specimensNote')}</p>
    </motion.section>
  )
}
