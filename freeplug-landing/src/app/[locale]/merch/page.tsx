'use client'

import Image from 'next/image'
import Link from 'next/link'
import { motion } from 'framer-motion'
import { Navigation } from '@/features/landing/components/Navigation'
import { Footer } from '@/features/landing/components/Footer'
import { fadeInUp, staggerContainer } from '@/features/landing/animations/landing.variants'
import { useLocale, useTranslations } from 'next-intl'
import { toAppLocale } from '@/i18n/config'
import { publicHref } from '@/i18n/routing'
import { MERCH_FONT_BUNDLE_SLUG } from '@/lib/merch/product'

export default function MerchIndexPage() {
  const t = useTranslations('public.merch')
  const locale = toAppLocale(useLocale())
  const productHref = publicHref(`/merch/${MERCH_FONT_BUNDLE_SLUG}`, locale)

  return (
    <>
      <Navigation />
      <main className="min-h-screen bg-gradient-to-b from-white to-zinc-50 pt-24">
        <section className="py-16 sm:py-24">
          <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8">
            <motion.div variants={staggerContainer} initial="hidden" animate="visible" className="grid lg:grid-cols-2 gap-12 items-center">
              <motion.div variants={fadeInUp}>
                <p className="text-sm font-semibold uppercase tracking-wider text-[#ba3d3d] mb-3">{t('eyebrow')}</p>
                <h1 className="text-3xl sm:text-4xl font-bold text-gray-900 mb-4">{t('heading')}</h1>
                <p className="text-lg text-gray-600 mb-8">{t('lead')}</p>
                <Link
                  href={productHref}
                  className="inline-flex items-center justify-center rounded-xl bg-[#ba3d3d] px-6 py-3 text-white font-semibold hover:bg-[#8a2e2e] transition-colors"
                >
                  {t('ctaProduct')}
                </Link>
              </motion.div>
              <motion.div variants={fadeInUp} className="relative aspect-[4/3] rounded-2xl overflow-hidden border border-gray-200 shadow-lg">
                <Image
                  src="/images/merch/compare-logo-vs-font.png"
                  alt={t('previewAlt')}
                  fill
                  unoptimized
                  className="object-cover"
                  sizes="(max-width: 1024px) 100vw, 50vw"
                  priority
                />
              </motion.div>
            </motion.div>
          </div>
        </section>
      </main>
      <Footer />
    </>
  )
}
