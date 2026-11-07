'use client'

import Link from 'next/link'
import { motion } from 'framer-motion'
import { MerchPageChrome } from '@/features/merch/components/MerchPageChrome'
import { fadeInUp, staggerContainer } from '@/features/landing/animations/landing.variants'
import { useTranslations } from 'next-intl'
import { SUPPORT_EMAIL } from '@/lib/site'

export default function MerchTshirtsPage() {
  const t = useTranslations('public.merch.tshirts')
  const mailto = `mailto:${SUPPORT_EMAIL}?subject=${encodeURIComponent(t('mailtoSubject'))}`

  return (
    <MerchPageChrome>
      <main className="min-h-screen bg-gradient-to-b from-white to-zinc-50 pt-8 pb-20">
        <div className="max-w-2xl mx-auto px-4 sm:px-6 lg:px-8">
          <motion.div variants={staggerContainer} initial="hidden" animate="visible" className="text-center">
            <motion.h1 variants={fadeInUp} className="text-3xl font-bold text-gray-900 mb-4">
              {t('heading')}
            </motion.h1>
            <motion.p variants={fadeInUp} className="text-lg text-gray-600 mb-8">
              {t('lead')}
            </motion.p>
            <motion.p variants={fadeInUp} className="text-sm text-gray-500">
              <Link href={mailto} className="text-[#ba3d3d] font-semibold hover:underline">
                {t('notify')}
              </Link>
            </motion.p>
          </motion.div>
        </div>
      </main>
    </MerchPageChrome>
  )
}
