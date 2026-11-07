'use client'

import { motion } from 'framer-motion'
import { Briefcase, Calendar, Globe, Palette, ShoppingBag, Store } from 'lucide-react'
import type { LucideIcon } from 'lucide-react'
import { useTranslations } from 'next-intl'
import { fadeInUp, staggerContainer } from '../animations/landing.variants'
import { buttonVariants } from '@/components/ui/button'
import { cn } from '@/lib/utils/cn'

const OFFERING_ORDER = ['local', 'agency', 'creator', 'booking', 'store', 'saas'] as const

const OFFERING_ICONS: Record<(typeof OFFERING_ORDER)[number], LucideIcon> = {
  local: Store,
  agency: Briefcase,
  creator: Palette,
  booking: Calendar,
  store: ShoppingBag,
  saas: Globe,
}

export function WhatWeBuildSection() {
  const t = useTranslations('public.landing.offerings')

  return (
    <section id="what-we-build" aria-labelledby="what-we-build-heading" className="py-16 sm:py-24 bg-white">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <motion.div
          variants={staggerContainer}
          initial="hidden"
          whileInView="visible"
          viewport={{ once: true, margin: '-80px' }}
        >
          <motion.div variants={fadeInUp} className="text-center mb-10 sm:mb-14">
            <h2 id="what-we-build-heading" className="text-3xl sm:text-4xl font-bold text-gray-900 mb-4">
              {t('heading')}
            </h2>
            <p className="text-lg text-gray-600 max-w-3xl mx-auto">{t('intro')}</p>
            <p
              className="mt-4 text-sm text-[#ba3d3d] font-medium"
              data-testid="in-development-line"
            >
              {t('developmentLine')}
            </p>
          </motion.div>

          <motion.div
            variants={fadeInUp}
            className="grid sm:grid-cols-2 lg:grid-cols-3 gap-6"
            data-testid="offerings-grid"
          >
            {OFFERING_ORDER.map((key) => {
              const Icon = OFFERING_ICONS[key]
              return (
                <article
                  key={key}
                  data-testid={`offering-${key}`}
                  className="rounded-2xl border border-zinc-200/80 bg-white shadow-sm hover:shadow-lg transition-shadow p-6 flex flex-col"
                >
                  <div className="flex items-start gap-4 mb-4">
                    <div className="w-11 h-11 rounded-xl bg-[#ba3d3d]/10 flex items-center justify-center shrink-0">
                      <Icon className="w-5 h-5 text-[#ba3d3d]" aria-hidden />
                    </div>
                    <div>
                      <h3 className="text-lg font-semibold text-gray-900">{t(`types.${key}.title`)}</h3>
                      {key === 'saas' && (
                        <span className="inline-block mt-1 text-xs font-medium text-[#ba3d3d] bg-[#ba3d3d]/10 px-2 py-0.5 rounded-full">
                          {t('saasTag')}
                        </span>
                      )}
                    </div>
                  </div>
                  <p className="text-gray-600 text-sm leading-relaxed flex-1">{t(`types.${key}.line`)}</p>
                  <span
                    data-testid="cta-paused"
                    className={cn(
                      buttonVariants({ variant: 'secondary', size: 'lg' }),
                      'mt-6 w-full opacity-60 pointer-events-none cursor-not-allowed'
                    )}
                    aria-disabled="true"
                  >
                    {t('cta')}
                  </span>
                </article>
              )
            })}
          </motion.div>
        </motion.div>
      </div>
    </section>
  )
}
