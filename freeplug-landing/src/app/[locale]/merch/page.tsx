'use client'

import Link from 'next/link'
import { MerchContainedImage } from '@/features/merch/components/MerchContainedImage'
import { motion } from 'framer-motion'
import { MerchPageChrome } from '@/features/merch/components/MerchPageChrome'
import { fadeInUp, staggerContainer } from '@/features/landing/animations/landing.variants'
import { useLocale, useTranslations } from 'next-intl'
import { toAppLocale } from '@/i18n/config'
import { publicHref } from '@/i18n/routing'
import { MERCH_FONT_BUNDLE_SLUG, MERCH_PERSONAL_USE_SLUG, MERCH_TSHIRTS_SLUG } from '@/lib/merch/product'
import { MERCH_COLLECTIONS } from '@/lib/merch/collections/catalog'

export default function MerchIndexPage() {
  const t = useTranslations('public.merch')
  const locale = toAppLocale(useLocale())

  const cards = [
    { href: '/merch/all', title: t('subnav.allMerch'), blurb: t('indexCardAll') },
    { href: `/merch/${MERCH_TSHIRTS_SLUG}`, title: t('subnav.tshirts'), blurb: t('indexCardTshirts') },
    ...MERCH_COLLECTIONS.map((slug) => ({
      href: `/merch/${slug}`,
      title: t(`subnav.collections.${slug}`),
      blurb: t(`collections.collectionLeads.${slug}`),
    })),
    { href: `/merch/${MERCH_FONT_BUNDLE_SLUG}`, title: t('subnav.officialFonts'), blurb: t('indexCardOfficial') },
    { href: `/merch/${MERCH_PERSONAL_USE_SLUG}`, title: t('subnav.personalUse'), blurb: t('indexCardPersonal') },
  ]

  return (
    <MerchPageChrome>
      <main className="min-h-screen min-w-0 bg-gradient-to-b from-white to-zinc-50 pt-6 sm:pt-8 pb-16 sm:pb-20">
        <section className="py-10 sm:py-12 lg:py-16">
          <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 min-w-0">
            <motion.div variants={staggerContainer} initial="hidden" animate="visible" className="grid lg:grid-cols-2 gap-8 sm:gap-12 items-start min-w-0">
              <motion.div variants={fadeInUp} className="min-w-0">
                <p className="text-sm font-semibold uppercase tracking-wider text-[#ba3d3d] mb-3">{t('eyebrow')}</p>
                <h1 className="text-2xl sm:text-3xl lg:text-4xl font-bold text-gray-900 mb-4 break-words">{t('heading')}</h1>
                <p className="text-base sm:text-lg text-gray-600 mb-6 sm:mb-8 break-words">{t('lead')}</p>
                <ul className="space-y-3 sm:space-y-4">
                  {cards.map((c) => (
                    <li key={c.href}>
                      <Link
                        href={publicHref(c.href, locale)}
                        className="block rounded-xl border border-gray-200 p-4 sm:p-5 min-h-11 hover:border-[#ba3d3d]/40 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#ba3d3d]/40"
                      >
                        <span className="font-semibold text-gray-900 break-words">{c.title}</span>
                        <p className="text-sm text-gray-600 mt-1 break-words">{c.blurb}</p>
                      </Link>
                    </li>
                  ))}
                </ul>
              </motion.div>
              <motion.div variants={fadeInUp} className="min-w-0 w-full shadow-lg rounded-2xl">
                <MerchContainedImage
                  src="/images/merch/compare-logo-vs-font.png"
                  alt={t('previewAlt')}
                  width={2600}
                  height={1860}
                  priority
                  sizes="(max-width: 1024px) 100vw, 50vw"
                />
              </motion.div>
            </motion.div>
          </div>
        </section>
      </main>
    </MerchPageChrome>
  )
}
