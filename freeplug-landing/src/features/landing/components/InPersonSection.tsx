'use client'

import { motion } from 'framer-motion'
import { Mail, MapPin, ShieldCheck } from 'lucide-react'
import { useTranslations } from 'next-intl'
import { buttonVariants } from '@/components/ui/button'
import { cn } from '@/lib/utils/cn'
import { fadeInUp, staggerContainer } from '../animations/landing.variants'

export const IN_PERSON_EMAIL = 'support@freeplug-in.dev'

/** In-person consultations (Cheke, Oct 31). Never render an address here: the location is shared only after screening. */
export function InPersonSection() {
  const t = useTranslations('public.landing.inPerson')
  const subject = encodeURIComponent(t('mailSubject'))
  return (
    <section className="py-20 bg-white" data-section="in-person" aria-labelledby="in-person-heading">
      <motion.div
        variants={staggerContainer}
        initial="hidden"
        whileInView="visible"
        viewport={{ once: true, margin: '-100px' }}
        className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8 text-center"
      >
        <motion.span variants={fadeInUp} className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-[#ba3d3d]/10 text-[#ba3d3d] text-sm font-medium mb-6">
          <MapPin size={16} />
          {t('eyebrow')}
        </motion.span>
        <motion.h2 id="in-person-heading" variants={fadeInUp} className="text-3xl sm:text-4xl md:text-5xl font-bold text-gray-900 mb-6">
          {t('heading')}
        </motion.h2>
        <motion.p variants={fadeInUp} className="text-lg text-gray-600 mb-4">
          {t('body')}
        </motion.p>
        <motion.p variants={fadeInUp} className="text-sm text-gray-500 mb-10 max-w-[34rem] mx-auto text-center">
          <ShieldCheck size={16} aria-hidden="true" className="inline-block align-[-3px] mr-1.5 text-[#ba3d3d]" />
          {t('privacy')}
        </motion.p>
        <motion.div variants={fadeInUp}>
          <a
            href={`mailto:${IN_PERSON_EMAIL}?subject=${subject}`}
            data-testid="in-person-email"
            className={cn(buttonVariants({ size: 'lg' }), 'px-8')}
          >
            <Mail size={20} className="mr-2" />
            {t('cta')}
          </a>
          <p className="mt-3 text-sm text-gray-500">{IN_PERSON_EMAIL}</p>
        </motion.div>
      </motion.div>
    </section>
  )
}
