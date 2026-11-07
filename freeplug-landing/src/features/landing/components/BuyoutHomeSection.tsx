'use client'

import Link from 'next/link'
import { motion } from 'framer-motion'
import { ArrowRight } from 'lucide-react'
import { useLocale, useTranslations } from 'next-intl'
import { toAppLocale } from '@/i18n/config'
import { publicHref } from '@/i18n/routing'
import { formatTierPrice } from '@/lib/buyout/tiers'
import { fadeInUp, staggerContainer } from '../animations/landing.variants'

const PRICED_TIERS = [
  { id: 'quick', cents: 50_000, labelKey: 'tier.quick' },
  { id: 'up_to_7', cents: 70_000, labelKey: 'tier.up_to_7' },
  { id: 'up_to_11', cents: 95_000, labelKey: 'tier.up_to_11' },
  { id: 'up_to_15', cents: 120_000, labelKey: 'tier.up_to_15' },
  { id: 'up_to_20', cents: 200_000, labelKey: 'tier.up_to_20' },
] as const

export function BuyoutHomeSection() {
  const t = useTranslations('public.landing.buyoutTiers')
  const locale = toAppLocale(useLocale())

  return (
    <section id="buyout" aria-labelledby="buyout-heading" className="py-16 sm:py-24 bg-white">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <motion.div
          variants={staggerContainer}
          initial="hidden"
          whileInView="visible"
          viewport={{ once: true, margin: '-80px' }}
        >
          <motion.div variants={fadeInUp} className="text-center mb-10">
            <span className="inline-block px-4 py-1.5 rounded-full bg-[#ba3d3d]/10 text-[#ba3d3d] text-sm font-semibold mb-4">
              {t('eyebrow')}
            </span>
            <h2 id="buyout-heading" className="text-3xl sm:text-4xl font-bold text-gray-900 mb-4">
              {t.rich('heading', {
                span: (chunks) => (
                  <span className="bg-gradient-to-r from-[#ba3d3d] to-[#8a2e2e] bg-clip-text text-transparent">
                    {chunks}
                  </span>
                ),
              })}
            </h2>
            <p className="text-lg text-gray-600 max-w-3xl mx-auto">{t('intro')}</p>
          </motion.div>

          <motion.ul
            variants={fadeInUp}
            className="grid grid-cols-2 gap-3 md:grid-cols-3 lg:grid-cols-6 md:gap-6"
            data-testid="buyout-tiers"
          >
            {PRICED_TIERS.map((tier) => (
              <li
                key={tier.id}
                className="rounded-xl border border-zinc-200 bg-zinc-50/80 p-4 text-center"
              >
                <p className="text-xs text-gray-500 mb-1">{t(tier.labelKey)}</p>
                <p className="text-xl font-bold text-gray-900">{formatTierPrice(tier.cents)}</p>
                <p className="text-xs text-gray-500 mt-1">{t('oneTime')}</p>
              </li>
            ))}
            <li className="rounded-xl border border-dashed border-zinc-300 bg-white p-4 text-center md:col-span-1">
              <p className="text-xs text-gray-500 mb-1">{t('tier.custom')}</p>
              <p className="text-lg font-bold text-gray-900">{t('customPrice')}</p>
              <p className="text-xs text-gray-500 mt-1">{t('customScope')}</p>
            </li>
          </motion.ul>

          <motion.p variants={fadeInUp} className="text-sm text-gray-600 text-center max-w-2xl mx-auto mt-8">
            {t('customLine')}
          </motion.p>
          <motion.p variants={fadeInUp} className="text-xs text-gray-500 text-center mt-3">
            {t('note')}
          </motion.p>
          <motion.div variants={fadeInUp} className="text-center mt-8">
            <Link
              href={publicHref('/compare', locale)}
              className="inline-flex items-center gap-2 text-[#ba3d3d] font-semibold hover:underline"
            >
              {t('compareLink')}
              <ArrowRight size={18} aria-hidden />
            </Link>
          </motion.div>
        </motion.div>
      </div>
    </section>
  )
}
