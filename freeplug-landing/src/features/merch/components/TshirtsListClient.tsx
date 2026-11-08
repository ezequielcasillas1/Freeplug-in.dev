'use client'

import Link from 'next/link'
import { motion } from 'framer-motion'
import { MerchPageChrome } from '@/features/merch/components/MerchPageChrome'
import { MerchContainedImage } from '@/features/merch/components/MerchContainedImage'
import { fadeInUp, staggerContainer } from '@/features/landing/animations/landing.variants'
import { useLocale, useTranslations } from 'next-intl'
import { toAppLocale } from '@/i18n/config'
import { publicHref } from '@/i18n/routing'
import { formatUsdFromCents, type PublicShirtProduct } from '@/lib/merch/shirts/catalog'

export function TshirtsListClient({ products }: { products: PublicShirtProduct[] }) {
  const t = useTranslations('public.merch.tshirts')
  const locale = toAppLocale(useLocale())

  return (
    <MerchPageChrome>
      <main className="min-h-screen min-w-0 bg-gradient-to-b from-white to-zinc-50 pt-6 sm:pt-8 pb-16 sm:pb-20">
        <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 min-w-0">
          <motion.div variants={staggerContainer} initial="hidden" animate="visible" className="min-w-0">
            <motion.h1 variants={fadeInUp} className="text-2xl sm:text-3xl font-bold text-gray-900 mb-3 break-words">
              {t('heading')}
            </motion.h1>
            <motion.p variants={fadeInUp} className="text-base sm:text-lg text-gray-600 mb-2 max-w-2xl">
              {t('listingLead')}
            </motion.p>
            <motion.p variants={fadeInUp} className="text-sm text-gray-500 mb-8 max-w-2xl">
              {t('priceFrontOnly')} · {t('priceFrontBack')}
            </motion.p>

            <ul className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3 min-w-0">
              {products.map((p) => {
                const img = p.mockups['Black-front'] ?? p.mockups['White-front']
                const title = t(`products.${p.titleKey}`)
                return (
                  <motion.li key={p.slug} variants={fadeInUp} className="min-w-0">
                    <Link
                      href={publicHref(`/merch/t-shirts/${p.slug}`, locale)}
                      className="block rounded-2xl border border-gray-200 bg-white overflow-hidden hover:border-[#ba3d3d]/40 transition-colors min-h-[44px]"
                    >
                      {img ? (
                        <MerchContainedImage
                          src={img}
                          alt={t('cardAlt', { title })}
                          width={1000}
                          height={1200}
                          className="border-0 rounded-none"
                          sizes="(max-width: 640px) 100vw, 320px"
                        />
                      ) : null}
                      <div className="p-4 min-w-0">
                        <h2 className="font-semibold text-gray-900 text-base break-words">{title}</h2>
                        <p className="text-sm text-[#ba3d3d] font-medium mt-1">
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
