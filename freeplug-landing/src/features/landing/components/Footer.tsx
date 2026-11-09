'use client'

import Link from 'next/link'
import { motion } from 'framer-motion'
import { Mail, MapPin, ArrowUpRight } from 'lucide-react'
import { fadeIn, fadeInUp, staggerContainer } from '../animations/landing.variants'
import { useLocale, useTranslations } from 'next-intl'
import { LanguagePicker } from '@/components/i18n/LanguagePicker'
import { TranslationNotice } from '@/components/i18n/TranslationNotice'
import { toAppLocale } from '@/i18n/config'
import { publicHref } from '@/i18n/routing'

// Labels are message keys under public.landing.footer.label; hrefs get /es on Spanish pages.
const footerLinks = {
  company: [
    { label: 'about', href: '/#about' },
    { label: 'outreach', href: '/#outreach' },
    { label: 'services', href: '/#services' },
    { label: 'reviews', href: '/#reviews' },
    { label: 'plans', href: '/#hosting-plans' },
  ],
  legal: [
    { label: 'termsConditions', href: null },
    { label: 'privacyPolicy', href: null },
    { label: 'cookiePolicy', href: null },
  ],
  contact: [
    { label: 'getStarted', href: '/signup' },
    { label: 'support', href: 'mailto:support@freeplug-in.dev' },
    { label: 'faq', href: '/faq' },
  ],
} as const

const socialLinks: { label: string; href: string }[] = [
  // Real profiles TBD — omit href="#" so we don't fake destinations
]

export function Footer() {
  const currentYear = new Date().getFullYear()
  const t = useTranslations('public.landing.footer')
  const locale = toAppLocale(useLocale())

  return (
    <motion.footer
      variants={fadeIn}
      initial="hidden"
      whileInView="visible"
      viewport={{ once: true }}
      className="relative overflow-hidden"
    >
      <div className="absolute inset-0 bg-gradient-to-b from-gray-900 via-gray-900 to-black" />
      <div className="absolute top-0 left-1/2 -translate-x-1/2 w-full h-px bg-gradient-to-r from-transparent via-[#ba3d3d]/50 to-transparent" />
      
      <div className="absolute inset-0 opacity-5">
        <div className="absolute inset-0" style={{
          backgroundImage: `radial-gradient(circle at 25% 25%, #ba3d3d 0%, transparent 50%)`,
        }} />
      </div>
      
      <div className="relative max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-16">
        <motion.div
          variants={staggerContainer}
          initial="hidden"
          whileInView="visible"
          viewport={{ once: true }}
          className="grid md:grid-cols-2 lg:grid-cols-5 gap-12 mb-16"
        >
          <motion.div variants={fadeInUp} className="lg:col-span-2">
            <Link href={publicHref('/', locale)} className="flex items-center gap-2 mb-6 group">
              <span className="text-3xl font-bold text-[#ba3d3d] group-hover:text-[#d44d4d] transition-colors">{t('freeplug')}</span>
            </Link>
            <p className="text-gray-400 leading-relaxed mb-6 max-w-sm">
              {t('freeplugHandlesOwnerOutreach72')}
            </p>
            
            <div className="space-y-3">
              <a href="mailto:support@freeplug-in.dev" className="flex items-center gap-3 text-gray-400 hover:text-white transition-colors group">
                <div className="w-10 h-10 rounded-xl bg-white/5 flex items-center justify-center group-hover:bg-[#ba3d3d]/20 transition-colors">
                  <Mail className="w-5 h-5" />
                </div>
                <span className="text-sm">{t('supportFreeplugDev')}</span>
              </a>
              <div className="flex items-center gap-3 text-gray-400">
                <div className="w-10 h-10 rounded-xl bg-white/5 flex items-center justify-center">
                  <MapPin className="w-5 h-5" />
                </div>
                <span className="text-sm">{t('centralTexasOutsideUsVia')}</span>
              </div>
            </div>
          </motion.div>

          <motion.div variants={fadeInUp}>
            <h4 className="font-semibold text-white mb-6 flex items-center gap-2">
              {t('headingCompany')}
              <span className="flex-1 h-px bg-gradient-to-r from-gray-700 to-transparent" />
            </h4>
            <ul className="space-y-4">
              {footerLinks.company.map((link) => (
                <li key={link.label}>
                  <a
                    href={publicHref(link.href, locale)}
                    className="text-gray-400 hover:text-white transition-colors text-sm flex items-center gap-1 group"
                  >
                    {t(`label.${link.label}`)}
                    <ArrowUpRight className="w-3 h-3 opacity-0 -translate-y-1 translate-x-1 group-hover:opacity-100 group-hover:translate-y-0 group-hover:translate-x-0 transition-all" />
                  </a>
                </li>
              ))}
            </ul>
          </motion.div>

          <motion.div variants={fadeInUp}>
            <h4 className="font-semibold text-white mb-6 flex items-center gap-2">
              {t('headingLegal')}
              <span className="flex-1 h-px bg-gradient-to-r from-gray-700 to-transparent" />
            </h4>
            <ul className="space-y-4">
              {footerLinks.legal.map((link) => (
                <li key={link.label}>
                  {link.href ? (
                    <a
                      href={link.href}
                      className="text-gray-400 hover:text-white transition-colors text-sm flex items-center gap-1 group"
                    >
                      {t(`label.${link.label}`)}
                      <ArrowUpRight className="w-3 h-3 opacity-0 -translate-y-1 translate-x-1 group-hover:opacity-100 group-hover:translate-y-0 group-hover:translate-x-0 transition-all" />
                    </a>
                  ) : (
                    <span className="text-gray-500 text-sm" title={t('legalComingSoonTitle')}>
                      {t(`label.${link.label}`)} <span className="text-gray-600">{t('legalSoonTag')}</span>
                    </span>
                  )}
                </li>
              ))}
            </ul>
          </motion.div>

          <motion.div variants={fadeInUp}>
            <h4 className="font-semibold text-white mb-6 flex items-center gap-2">
              {t('headingGetStarted')}
              <span className="flex-1 h-px bg-gradient-to-r from-gray-700 to-transparent" />
            </h4>
            <ul className="space-y-4">
              {footerLinks.contact.map((link) => (
                <li key={link.label}>
                  <a
                    href={publicHref(link.href, locale)}
                    className="text-gray-400 hover:text-white transition-colors text-sm flex items-center gap-1 group"
                  >
                    {t(`label.${link.label}`)}
                    <ArrowUpRight className="w-3 h-3 opacity-0 -translate-y-1 translate-x-1 group-hover:opacity-100 group-hover:translate-y-0 group-hover:translate-x-0 transition-all" />
                  </a>
                </li>
              ))}
            </ul>
            
            {socialLinks.length > 0 && (
              <div className="mt-8">
                <p className="text-gray-500 text-xs mb-3">{t('followUs')}</p>
                <div className="flex gap-2">
                  {socialLinks.map((social) => (
                    <a
                      key={social.label}
                      href={social.href}
                      aria-label={social.label}
                      className="px-3 py-2 rounded-xl bg-white/5 flex items-center justify-center text-gray-400 hover:text-white hover:bg-[#ba3d3d]/20 transition-all text-xs font-medium"
                    >
                      {social.label}
                    </a>
                  ))}
                </div>
              </div>
            )}
          </motion.div>
        </motion.div>

        <div className="border-t border-gray-800 pt-8">
          <div className="flex flex-col sm:flex-row justify-between items-center gap-4">
            <p className="text-gray-500 text-sm">
              {t('copyright', { year: currentYear })}
            </p>
            <p className="text-gray-600 text-sm flex items-center gap-2">
              {t('outreachFreeplugBuilds72After')}
            </p>
            <LanguagePicker variant="dark" />
          </div>
          {/* Aria 9:53: legal line in the footer of every Spanish page (renders nothing in English). */}
          <TranslationNotice className="mt-6 text-center text-gray-500" />
        </div>
      </div>
    </motion.footer>
  )
}
