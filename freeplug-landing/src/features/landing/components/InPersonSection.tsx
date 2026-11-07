'use client'

import { motion } from 'framer-motion'
import { Mail, MapPin, ShieldCheck } from 'lucide-react'
import { useTranslations } from 'next-intl'
import { fadeInUp, staggerContainer } from '../animations/landing.variants'
import { SUPPORT_EMAIL } from '@/lib/site'

export function InPersonSection() {
  const t = useTranslations('public.landing.inPerson')
  const mailto = `mailto:${SUPPORT_EMAIL}?subject=${encodeURIComponent(t('mailSubject'))}`

  return (
    <section
      data-section="in-person"
      aria-labelledby="in-person-heading"
      className="py-20 bg-white relative overflow-hidden"
    >
      <motion.div
        variants={staggerContainer}
        initial="hidden"
        whileInView="visible"
        viewport={{ once: true, margin: '-80px' }}
        className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8 text-center"
      >
        <motion.span
          variants={fadeInUp}
          className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-[#ba3d3d]/10 text-[#ba3d3d] text-sm font-medium mb-6"
        >
          <MapPin size={16} aria-hidden />
          {t('eyebrow')}
        </motion.span>
        <motion.h2
          id="in-person-heading"
          variants={fadeInUp}
          className="text-3xl sm:text-4xl md:text-5xl font-bold text-gray-900 mb-6"
        >
          {t('heading')}
        </motion.h2>
        <motion.p variants={fadeInUp} className="text-lg text-gray-600 mb-4">
          {t('body')}
        </motion.p>
        <motion.p
          variants={fadeInUp}
          className="text-sm text-gray-500 mb-10 max-w-[34rem] mx-auto text-center"
        >
          <ShieldCheck
            className="inline-block align-[-3px] mr-1.5 text-[#ba3d3d]"
            size={16}
            aria-hidden
          />
          {t('privacy')}
        </motion.p>
        <motion.div variants={fadeInUp}>
          <a
            href={mailto}
            data-testid="in-person-email"
            className="inline-flex items-center justify-center rounded-lg font-semibold transition-all duration-200 focus:outline-none focus:ring-2 focus:ring-offset-2 bg-[#ba3d3d] text-white hover:bg-[#a33535] focus:ring-[#ba3d3d] py-4 text-lg px-8 gap-2"
          >
            <Mail size={20} aria-hidden />
            {t('cta')}
          </a>
        </motion.div>
      </motion.div>
    </section>
  )
}
