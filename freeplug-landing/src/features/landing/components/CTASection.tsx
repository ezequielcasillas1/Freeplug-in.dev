'use client'

import { motion } from 'framer-motion'
import { ArrowRight, Shield, Sparkles } from 'lucide-react'
import Link from 'next/link'
import { buttonVariants } from '@/components/ui/button'
import { cn } from '@/lib/utils/cn'
import { fadeInUp, staggerContainer } from '../animations/landing.variants'
import { useLocale, useTranslations } from 'next-intl'
import { toAppLocale } from '@/i18n/config'
import { publicHref } from '@/i18n/routing'

export function CTASection() {
  const t = useTranslations('public.landing.cTA')
  const locale = toAppLocale(useLocale())
  return (
    <section className="py-24 relative overflow-hidden">
      <div className="absolute inset-0 bg-gradient-to-br from-[#ba3d3d] via-[#a53434] to-[#8a2e2e]" />
      
      <div className="absolute inset-0">
        <motion.div
          animate={{ 
            scale: [1, 1.2, 1],
            opacity: [0.3, 0.5, 0.3],
          }}
          transition={{ duration: 8, repeat: Infinity }}
          className="absolute top-1/4 left-1/4 w-96 h-96 bg-white/10 rounded-full blur-3xl"
        />
        <motion.div
          animate={{ 
            scale: [1.2, 1, 1.2],
            opacity: [0.2, 0.4, 0.2],
          }}
          transition={{ duration: 10, repeat: Infinity }}
          className="absolute bottom-1/4 right-1/4 w-80 h-80 bg-white/10 rounded-full blur-3xl"
        />
      </div>
      
      <div className="absolute inset-0 opacity-10">
        <div className="absolute inset-0" style={{
          backgroundImage: `
            linear-gradient(rgba(255, 255, 255, 0.1) 1px, transparent 1px),
            linear-gradient(90deg, rgba(255, 255, 255, 0.1) 1px, transparent 1px)
          `,
          backgroundSize: '40px 40px',
        }} />
      </div>
      
      <motion.div
        variants={staggerContainer}
        initial="hidden"
        whileInView="visible"
        viewport={{ once: true, margin: '-100px' }}
        className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 text-center relative z-10"
      >
        <motion.div variants={fadeInUp} className="mb-8">
          <span className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-white/10 backdrop-blur-sm text-white text-sm font-medium border border-white/20">
            <Sparkles size={16} className="animate-pulse" />
            {t('freeplug72After')}
          </span>
        </motion.div>
        
        <motion.h2
          variants={fadeInUp}
          className="text-3xl sm:text-4xl md:text-5xl lg:text-6xl font-bold text-white mb-6"
        >
          {t('readyFreeWebsite')}
        </motion.h2>
        
        <motion.p
          variants={fadeInUp}
          className="text-lg sm:text-xl text-white/80 mb-10 max-w-2xl mx-auto"
        >
          {t('localOwnersSanMarcosKyle')}
        </motion.p>
        
        <motion.div
          variants={fadeInUp}
          className="flex flex-col sm:flex-row items-center justify-center gap-4"
        >
          <Link
            href={publicHref('/signup', locale)}
            className={cn(
              buttonVariants({ size: 'lg' }),
              'bg-white text-[#ba3d3d] hover:bg-gray-100 group shadow-xl shadow-black/20 hover:shadow-2xl hover:shadow-black/30 transition-all px-8 border-0'
            )}
          >
            {t('requestFreeWebsite')}
            <ArrowRight size={20} className="ml-2 group-hover:translate-x-1 transition-transform" />
          </Link>
        </motion.div>
        
        <motion.div
          variants={fadeInUp}
          className="mt-10 flex items-center justify-center gap-2 text-white/60 text-sm"
        >
          <Shield size={16} />
          <span>{t('freeplugFindsBusinesses72After')}</span>
        </motion.div>
      </motion.div>
    </section>
  )
}
