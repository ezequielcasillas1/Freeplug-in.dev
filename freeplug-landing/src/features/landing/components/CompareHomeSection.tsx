'use client'

import Link from 'next/link'
import { ArrowRight } from 'lucide-react'
import { motion } from 'framer-motion'
import { useLocale, useTranslations } from 'next-intl'
import { toAppLocale } from '@/i18n/config'
import { publicHref } from '@/i18n/routing'
import { fadeInUp, staggerContainer } from '../animations/landing.variants'
import { CompareTable } from './CompareTable'

export function CompareHomeSection() {
  const t = useTranslations('public.compare')
  const locale = toAppLocale(useLocale())

  return (
    <section
      id="compare"
      data-section="compare"
      aria-labelledby="compare-teaser-heading"
      className="py-16 sm:py-24 bg-zinc-50 border-y border-zinc-200/80"
    >
      <motion.div
        variants={staggerContainer}
        initial="hidden"
        whileInView="visible"
        viewport={{ once: true, margin: '-80px' }}
        className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8"
      >
        <motion.div variants={fadeInUp} className="text-center mb-10 sm:mb-12">
          <h2 id="compare-teaser-heading" className="text-3xl sm:text-4xl font-bold text-gray-900 mb-4">
            {t('teaserHeading')}
          </h2>
          <p className="text-lg text-gray-600 max-w-3xl mx-auto">{t('teaserIntro')}</p>
        </motion.div>
        <motion.div variants={fadeInUp}>
          <CompareTable teaser />
        </motion.div>
        <motion.div variants={fadeInUp} className="mt-10 flex flex-col sm:flex-row items-center justify-center gap-4">
          <Link
            href={publicHref('/compare', locale)}
            className="inline-flex items-center gap-2 text-[#ba3d3d] font-semibold hover:underline"
          >
            {t('homeLink')}
            <ArrowRight size={18} aria-hidden />
          </Link>
          <Link
            href={publicHref('/#hosting-plans', locale)}
            className="text-gray-600 hover:text-[#ba3d3d] text-sm font-medium"
          >
            {t('seePricing')}
          </Link>
        </motion.div>
      </motion.div>
    </section>
  )
}
