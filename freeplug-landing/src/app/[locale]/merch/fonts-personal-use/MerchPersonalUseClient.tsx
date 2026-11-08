'use client'

import { motion } from 'framer-motion'
import { MerchContainedImage } from '@/features/merch/components/MerchContainedImage'
import { MerchPageChrome } from '@/features/merch/components/MerchPageChrome'
import { PersonalDownloadBlock } from '@/features/merch/components/PersonalDownloadBlock'
import { fadeInUp, staggerContainer } from '@/features/landing/animations/landing.variants'
import { useTranslations } from 'next-intl'

export function MerchPersonalUseClient({ downloadEnabled }: { downloadEnabled: boolean }) {
  const t = useTranslations('public.merch.personalUse')

  return (
    <MerchPageChrome>
      <main className="min-h-screen min-w-0 bg-gradient-to-b from-white to-zinc-50 pt-6 sm:pt-8 pb-16 sm:pb-20">
        <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8 min-w-0">
          <motion.div variants={staggerContainer} initial="hidden" animate="visible" className="space-y-6">
            <motion.h1 variants={fadeInUp} className="text-2xl sm:text-3xl font-bold text-gray-900 break-words">
              {t('heading')}
            </motion.h1>
            <motion.p variants={fadeInUp} className="text-base sm:text-lg text-gray-600 break-words">
              {t('lead')}
            </motion.p>
            <motion.p variants={fadeInUp} className="text-gray-700 break-words">
              {t('commercialNote')}
            </motion.p>

            <motion.div variants={fadeInUp} className="w-full min-w-0">
              <MerchContainedImage
                src="/images/merch/specimen-demo.png"
                alt={t('specimenAlt')}
                width={1800}
                height={1150}
                sizes="(max-width: 768px) 100vw, 640px"
              />
            </motion.div>

            <motion.section variants={fadeInUp}>
              <h2 className="text-lg font-semibold text-gray-900 mb-2">{t('packHeading')}</h2>
              <ul className="list-disc pl-5 text-gray-700 space-y-1 text-sm break-words">
                <li>{t('packItemExtended')}</li>
                <li>{t('packItemDispatch')}</li>
                <li>{t('packItemCursive')}</li>
              </ul>
              <p className="mt-2 text-sm text-gray-600">{t('packGlyphs')}</p>
            </motion.section>

            <motion.div variants={fadeInUp} className="rounded-xl border border-gray-200 bg-white p-6">
              <PersonalDownloadBlock
                    enabled={downloadEnabled}
                copy={{
                  comingSoon: t('downloadComingSoon'),
                  downloadCta: t('downloadCta'),
                  emailOptional: t('emailOptional'),
                  emailPlaceholder: t('emailPlaceholder'),
                  licenseNote: t('licenseNote'),
                  errorGeneric: t('errorGeneric'),
                }}
              />
            </motion.div>
            <motion.p variants={fadeInUp} className="text-sm text-gray-600">
              {t('aiDisclosure')}
            </motion.p>
          </motion.div>
        </div>
      </main>
    </MerchPageChrome>
  )
}
