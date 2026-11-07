'use client'

import Image from 'next/image'
import Link from 'next/link'
import { motion } from 'framer-motion'
import { Navigation } from '@/features/landing/components/Navigation'
import { Footer } from '@/features/landing/components/Footer'
import { MerchCheckoutButton } from '@/features/merch/components/MerchCheckoutButton'
import { fadeInUp, staggerContainer } from '@/features/landing/animations/landing.variants'
import { FONT_BUNDLE_STYLES, FONT_BUNDLE_USE_CASES } from '@/lib/merch/product'
import { useLocale, useTranslations } from 'next-intl'
import { toAppLocale } from '@/i18n/config'
import { publicHref } from '@/i18n/routing'

export default function FontBundleProductPage() {
  const t = useTranslations('public.merch')
  const locale = toAppLocale(useLocale())

  return (
    <>
      <Navigation />
      <main className="min-h-screen bg-gradient-to-b from-white to-zinc-50 pt-24">
        <article className="py-16 sm:py-20">
          <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8">
            <motion.div variants={staggerContainer} initial="hidden" animate="visible">
              <motion.p variants={fadeInUp} className="text-sm text-gray-500 mb-2">
                <Link href={publicHref('/merch', locale)} className="hover:text-[#ba3d3d]">
                  {t('breadcrumbMerch')}
                </Link>
                <span className="mx-2">/</span>
                <span>{t('productName')}</span>
              </motion.p>
              <motion.h1 variants={fadeInUp} className="text-3xl sm:text-4xl font-bold text-gray-900 mb-2">
                {t('productName')}
              </motion.h1>
              <motion.p variants={fadeInUp} className="text-2xl font-semibold text-[#ba3d3d] mb-6">
                {t('price')}
              </motion.p>
              <motion.p variants={fadeInUp} className="text-lg text-gray-600 mb-8 max-w-2xl">
                {t('productLead')}
              </motion.p>

              <div className="grid lg:grid-cols-2 gap-10 mb-12">
                <motion.div variants={fadeInUp} className="space-y-4">
                  <div className="relative aspect-[3/4] rounded-2xl overflow-hidden border border-gray-200">
                    <Image
                      src="/images/merch/specimen-fp-cursive.png"
                      alt={t('specimenAlt')}
                      fill
                      unoptimized
                      className="object-cover object-top"
                      sizes="(max-width: 1024px) 100vw, 480px"
                    />
                  </div>
                  <div className="relative aspect-video rounded-2xl overflow-hidden border border-gray-200">
                    <Image
                      src="/images/merch/compare-logo-vs-font.png"
                      alt={t('compareAlt')}
                      fill
                      unoptimized
                      className="object-cover"
                      sizes="(max-width: 1024px) 100vw, 480px"
                    />
                  </div>
                </motion.div>

                <motion.div variants={fadeInUp} className="space-y-8">
                  <section>
                    <h2 className="text-xl font-bold text-gray-900 mb-3">{t('stylesHeading')}</h2>
                    <ul className="list-disc pl-5 text-gray-700 space-y-2">
                      {FONT_BUNDLE_STYLES.map((line) => (
                        <li key={line}>{line}</li>
                      ))}
                    </ul>
                    <p className="mt-4 text-sm text-gray-600">{t('stylesSeo')}</p>
                  </section>

                  <section>
                    <h2 className="text-xl font-bold text-gray-900 mb-3">{t('useCasesHeading')}</h2>
                    <ul className="list-disc pl-5 text-gray-700 space-y-2">
                      {FONT_BUNDLE_USE_CASES.map((line) => (
                        <li key={line}>{line}</li>
                      ))}
                    </ul>
                  </section>

                  <MerchCheckoutButton
                    label={t('buyCta')}
                    emailOptional={t('emailOptional')}
                    emailPlaceholder={t('emailPlaceholder')}
                    errorGeneric={t('checkoutError')}
                    mockNotice={t('mockNotice')}
                  />

                  <section className="rounded-xl border border-gray-200 bg-white p-5 text-sm text-gray-700 space-y-3">
                    <h2 className="text-base font-semibold text-gray-900">{t('licenseHeading')}</h2>
                    <p>{t('licenseBody')}</p>
                    <p className="text-gray-600">{t('aiDisclosure')}</p>
                    <p>{t('refund')}</p>
                  </section>
                </motion.div>
              </div>

              <motion.section variants={fadeInUp} className="max-w-3xl">
                <h2 className="text-xl font-bold text-gray-900 mb-4">{t('faqHeading')}</h2>
                <dl className="space-y-4">
                  {[1, 2, 3].map((n) => (
                    <div key={n}>
                      <dt className="font-semibold text-gray-900">{t(`faq.q${n}`)}</dt>
                      <dd className="text-gray-600 mt-1">{t(`faq.a${n}`)}</dd>
                    </div>
                  ))}
                </dl>
              </motion.section>
            </motion.div>
          </div>
        </article>
      </main>
      <Footer />
    </>
  )
}
