'use client'

import Link from 'next/link'
import { motion } from 'framer-motion'
import { MerchPageChrome } from '@/features/merch/components/MerchPageChrome'
import { MerchContainedImage } from '@/features/merch/components/MerchContainedImage'
import { fadeInUp, staggerContainer } from '@/features/landing/animations/landing.variants'
import { useLocale, useTranslations } from 'next-intl'
import { toAppLocale } from '@/i18n/config'
import { publicHref } from '@/i18n/routing'
import { MERCH_PAGE_TITLE_SCROLL_MT, MERCH_TSHIRT_MAIN_CLASS } from '@/features/merch/merch-main-layout'
import { formatUsdFromCents, type MerchCollectionSlug, type PublicCollectionProduct } from '@/lib/merch/collections/catalog'

export function CollectionListClient({
  collection,
  products,
}: {
  collection: MerchCollectionSlug
  products: PublicCollectionProduct[]
}) {
  const t = useTranslations('public.merch.collections')
  const locale = toAppLocale(useLocale())

  return (
    <MerchPageChrome>
      <main className={MERCH_TSHIRT_MAIN_CLASS}>
        <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 min-w-0">
          <motion.div variants={staggerContainer} initial="hidden" animate="visible" className="min-w-0">
            <motion.p variants={fadeInUp} className="text-sm text-gray-500 mb-3">
              <Link href={publicHref('/merch', locale)} className="hover:text-[#ba3d3d] min-h-[44px] inline-flex items-center">
                {t('breadcrumbMerch')}
              </Link>
            </motion.p>
            <motion.h1
              variants={fadeInUp}
              className={`${MERCH_PAGE_TITLE_SCROLL_MT} text-2xl sm:text-3xl font-bold text-gray-900 mb-3 break-words`}
            >
              {t(`collectionTitles.${collection}`)}
            </motion.h1>
            <motion.div variants={fadeInUp} className="mb-6 sm:mb-8 max-w-2xl space-y-2">
              <p className="text-base sm:text-lg text-gray-600 leading-relaxed">{t(`collectionLeads.${collection}`)}</p>
              <p className="text-sm sm:text-base text-[#ba3d3d] font-medium">{t('freeShippingPromo')}</p>
            </motion.div>

            <ul className="grid grid-cols-1 min-[360px]:grid-cols-2 gap-4 sm:gap-5 lg:grid-cols-3 min-w-0">
              {products.map((p) => {
                const title = t(`products.${p.titleKey}`)
                return (
                  <motion.li key={p.slug} variants={fadeInUp} className="min-w-0">
                    <Link
                      href={publicHref(`/merch/${collection}/${p.slug}`, locale)}
                      className="block rounded-2xl border border-gray-200 bg-white overflow-hidden hover:border-[#ba3d3d]/40 transition-colors min-h-[44px]"
                    >
                      <MerchContainedImage
                        src={p.mockupSrc}
                        alt={t('cardAlt', { title })}
                        width={1000}
                        height={1200}
                        className="border-0 rounded-none"
                        sizes="(max-width: 640px) 100vw, 320px"
                      />
                      <div className="p-3.5 sm:p-4 min-w-0">
                        <h2 className="font-semibold text-gray-900 text-[0.95rem] min-[360px]:text-base leading-snug break-words">
                          {title}
                        </h2>
                        <p className="text-sm min-[360px]:text-base text-[#ba3d3d] font-semibold mt-1.5">
                          {t('fromPrice', { price: formatUsdFromCents(p.fromPriceCents) })}
                        </p>
                      </div>
                    </Link>
                  </motion.li>
                )
              })}
            </ul>
          </motion.div>
        </div>
      </main>
    </MerchPageChrome>
  )
}
