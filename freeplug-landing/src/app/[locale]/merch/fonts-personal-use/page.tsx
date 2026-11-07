'use client'

import { motion } from 'framer-motion'
import { MerchPageChrome } from '@/features/merch/components/MerchPageChrome'
import { PersonalDownloadBlock } from '@/features/merch/components/PersonalDownloadBlock'
import { fadeInUp, staggerContainer } from '@/features/landing/animations/landing.variants'
import { useTranslations } from 'next-intl'

export default function MerchPersonalUsePage() {
  const t = useTranslations('public.merch.personalUse')

  return (
    <MerchPageChrome>
      <main className="min-h-screen bg-gradient-to-b from-white to-zinc-50 pt-8 pb-20">
        <div className="max-w-2xl mx-auto px-4 sm:px-6 lg:px-8">
          <motion.div variants={staggerContainer} initial="hidden" animate="visible" className="space-y-6">
            <motion.h1 variants={fadeInUp} className="text-3xl font-bold text-gray-900">
              {t('heading')}
            </motion.h1>
            <motion.p variants={fadeInUp} className="text-lg text-gray-600">
              {t('lead')}
            </motion.p>
            <motion.p variants={fadeInUp} className="text-gray-700">
              {t('commercialNote')}
            </motion.p>
            <motion.div variants={fadeInUp} className="rounded-xl border border-gray-200 bg-white p-6">
              <PersonalDownloadBlock
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
