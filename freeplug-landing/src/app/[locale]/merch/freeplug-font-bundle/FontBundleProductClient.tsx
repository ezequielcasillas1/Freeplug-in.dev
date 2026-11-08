'use client'

import Link from 'next/link'
import { MerchContainedImage } from '@/features/merch/components/MerchContainedImage'
import { motion } from 'framer-motion'
import { MerchPageChrome } from '@/features/merch/components/MerchPageChrome'
import { MerchCheckoutBlock } from '@/features/merch/components/MerchCheckoutBlock'
import { fadeInUp, staggerContainer } from '@/features/landing/animations/landing.variants'
import { FONT_BUNDLE_STYLES, FONT_BUNDLE_USE_CASES } from '@/lib/merch/product'
import { useLocale, useTranslations } from 'next-intl'
import { toAppLocale } from '@/i18n/config'
import { publicHref } from '@/i18n/routing'

export function FontBundleProductClient({ checkoutEnabled }: { checkoutEnabled: boolean }) {
  const t = useTranslations('public.merch')
  const locale = toAppLocale(useLocale())

  return (
    <MerchPageChrome>
      <main className="min-h-screen min-w-0 bg-gradient-to-b from-white to-zinc-50 pt-6 sm:pt-8">
        <article className="py-10 sm:py-16 lg:py-20">
          <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 min-w-0">
            <motion.div variants={staggerContainer} initial="hidden" animate="visible">
              <motion.p variants={fadeInUp} className="text-sm text-gray-500 mb-2 flex flex-wrap items-center gap-x-2 gap-y-1 break-words">
                <Link href={publicHref('/merch', locale)} className="hover:text-[#ba3d3d]">
                  {t('breadcrumbMerch')}
                </Link>
                <span className="text-gray-400" aria-hidden>
                  /
                </span>
                <span className="min-w-0">{t('productName')}</span>
              </motion.p>
              <motion.h1 variants={fadeInUp} className="text-2xl sm:text-3xl lg:text-4xl font-bold text-gray-900 mb-2 break-words">
                {t('productName')}
              </motion.h1>
              <motion.p variants={fadeInUp} className="text-xl sm:text-2xl font-semibold text-[#ba3d3d] mb-4 sm:mb-6">
                {t('price')}
              </motion.p>
              <motion.p variants={fadeInUp} className="text-base sm:text-lg text-gray-600 mb-6 sm:mb-8 max-w-2xl break-words">
                {t('productLead')}
              </motion.p>

              <div className="grid lg:grid-cols-2 gap-6 sm:gap-10 mb-10 sm:mb-12 min-w-0">
                <motion.div variants={fadeInUp} className="space-y-4 min-w-0">
                  <MerchContainedImage
                    src="/images/merch/specimen-fp-cursive.png"
                    alt={t('specimenAlt')}
                    width={2400}
                    height={2270}
                  />
                  <MerchContainedImage
                    src="/images/merch/compare-logo-vs-font.png"
                    alt={t('compareAlt')}
                    width={2600}
                    height={1860}
                  />
                </motion.div>

                <motion.div variants={fadeInUp} className="space-y-6 sm:space-y-8 min-w-0">
                  <section className="min-w-0">
                    <h2 className="text-xl font-bold text-gray-900 mb-3">{t('stylesHeading')}</h2>
                    <ul className="list-disc pl-5 text-gray-700 space-y-2 break-words">
                      {FONT_BUNDLE_STYLES.map((line) => (
                        <li key={line}>{line}</li>
                      ))}
                    </ul>
                    <p className="mt-4 text-sm text-gray-600">{t('stylesSeo')}</p>
                  </section>

                  <section>
                    <h2 className="text-xl font-bold text-gray-900 mb-3">{t('useCasesHeading')}</h2>
                    <ul className="list-disc pl-5 text-gray-700 space-y-2 break-words">
                      {FONT_BUNDLE_USE_CASES.map((line) => (
                        <li key={line}>{line}</li>
                      ))}
                    </ul>
                  </section>

                  <MerchCheckoutBlock
                    enabled={checkoutEnabled}
                    copy={{
                      buyCta: t('buyCta'),
                      comingSoon: t('comingSoon'),
                      emailOptional: t('emailOptional'),
                      emailPlaceholder: t('emailPlaceholder'),
                      checkoutError: t('checkoutError'),
                      mockNotice: t('mockNotice'),
                    }}
                  />

                  <section className="rounded-xl border border-gray-200 bg-white p-4 sm:p-5 text-sm text-gray-700 space-y-3 break-words">
                    <h2 className="text-base font-semibold text-gray-900">{t('licenseHeading')}</h2>
                    <p>{t('licenseBody')}</p>
                    <p className="text-gray-600">{t('aiDisclosure')}</p>
                    <p>{t('refund')}</p>
                  </section>
                </motion.div>
              </div>

              <motion.section variants={fadeInUp} className="max-w-3xl min-w-0 break-words">
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
    </MerchPageChrome>
  )
}
