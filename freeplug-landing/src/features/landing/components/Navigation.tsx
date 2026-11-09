'use client'

import { motion, useScroll, useTransform } from 'framer-motion'
import { Menu, X } from 'lucide-react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { useState, useEffect } from 'react'
import { Button, buttonVariants } from '@/components/ui/button'
import { AUTH_MAINTENANCE } from '@/lib/auth/signups-paused'
import { CALCOM_BOOKING_URL } from '@/lib/booking'
import { PausedCta } from '@/components/cta/PausedCta'
import { CTA_PAUSED_NOW } from '@/lib/cta-pause'
import { cn } from '@/lib/utils/cn'
import { fadeIn } from '../animations/landing.variants'
import { useLocale, useTranslations } from 'next-intl'
import { LanguagePicker } from '@/components/i18n/LanguagePicker'
import { toAppLocale } from '@/i18n/config'
import { publicHref } from '@/i18n/routing'
import { MerchandiseNavMenu } from '@/features/landing/components/MerchandiseNavMenu'
import { MERCH_COLLECTIONS } from '@/lib/merch/collections/catalog'
import { MERCH_TSHIRTS_SLUG } from '@/lib/merch/product'
import { isMerchShopNavVisible } from '@/lib/merch/flags'

// Labels are message keys (public.landing.*); hrefs get /es on Spanish pages (publicHref).
const navLinks = [
  { labelKey: 'navigation.label.home', href: '/#hero' },
  { labelKey: 'footer.label.about', href: '/#about' },
  { labelKey: 'footer.label.outreach', href: '/#outreach' },
  { labelKey: 'footer.label.services', href: '/#services' },
  { labelKey: 'footer.label.reviews', href: '/#reviews' },
  { labelKey: 'footer.label.plans', href: '/#hosting-plans' },
] as const

export function Navigation() {
  const router = useRouter()
  const t = useTranslations('public.landing')
  const locale = toAppLocale(useLocale())
  const tMerch = useTranslations('public.merch')
  const [isOpen, setIsOpen] = useState(false)
  const [merchOpen, setMerchOpen] = useState(false)
  const [hasScrolled, setHasScrolled] = useState(false)
  const shopNav = isMerchShopNavVisible()

  const merchLinks = [
    { slug: 'all', label: tMerch('subnav.allMerch') },
    { slug: MERCH_TSHIRTS_SLUG, label: tMerch('subnav.tshirts') },
    ...MERCH_COLLECTIONS.map((slug) => ({ slug, label: tMerch(`subnav.collections.${slug}`) })),
  ]
  
  const { scrollY } = useScroll()
  const backgroundColor = useTransform(
    scrollY,
    [0, 100],
    ['rgba(255, 255, 255, 0.5)', 'rgba(255, 255, 255, 0.95)']
  )
  const borderOpacity = useTransform(scrollY, [0, 100], [0, 1])

  useEffect(() => {
    const handleScroll = () => {
      setHasScrolled(window.scrollY > 20)
    }
    window.addEventListener('scroll', handleScroll)
    return () => window.removeEventListener('scroll', handleScroll)
  }, [])

  return (
    <motion.nav
      variants={fadeIn}
      initial="hidden"
      animate="visible"
      style={{ backgroundColor }}
      className={cn(
        "fixed top-0 left-0 right-0 z-50 backdrop-blur-xl transition-shadow duration-300",
        hasScrolled && "shadow-lg shadow-black/5"
      )}
    >
      <motion.div
        className="absolute bottom-0 left-0 right-0 h-px bg-gray-200"
        style={{ opacity: borderOpacity }}
      />
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-16 sm:h-20">
          <Link href={publicHref('/', locale)} className="flex items-center gap-2 group">
            <motion.div
              whileHover={{ rotate: [0, -10, 10, 0] }}
              transition={{ duration: 0.5 }}
              className="w-8 h-8 rounded-full flex items-center justify-center shadow-lg shadow-[#ba3d3d]/30"
            >
              {/* FP mark (Oct 22 2026), replaces the Sparkles tile. Plain img: keeps /_next/image off Cloudflare Images. */}
              <img src="/images/brand/fp-logo-64.png" alt="" width={32} height={32} className="w-8 h-8 rounded-full" />
            </motion.div>
            <span className="text-2xl font-bold text-[#ba3d3d] group-hover:text-[#8a2e2e] transition-colors">{t('footer.freeplug')}</span>
          </Link>

          <div className="hidden lg:flex items-center gap-1">
            <a
              href={publicHref('/#hero', locale)}
              className="relative px-4 py-2 text-gray-600 hover:text-[#ba3d3d] transition-colors font-medium group"
            >
              {t('navigation.label.home')}
              <span className="absolute bottom-0 left-1/2 -translate-x-1/2 w-0 h-0.5 bg-[#ba3d3d] group-hover:w-1/2 transition-all duration-300 rounded-full" />
            </a>
            <MerchandiseNavMenu />
            {shopNav ? (
              <Link
                href={publicHref('/shop', locale)}
                className="relative px-4 py-2 text-gray-600 hover:text-[#ba3d3d] transition-colors font-medium group"
              >
                {t('navigation.label.shop')}
                <span className="absolute bottom-0 left-1/2 -translate-x-1/2 w-0 h-0.5 bg-[#ba3d3d] group-hover:w-1/2 transition-all duration-300 rounded-full" />
              </Link>
            ) : null}
            {navLinks
              .filter((link) => link.labelKey !== 'navigation.label.home')
              .map((link) => (
                <a
                  key={link.labelKey}
                  href={publicHref(link.href, locale)}
                  className="relative px-4 py-2 text-gray-600 hover:text-[#ba3d3d] transition-colors font-medium group"
                >
                  {t(link.labelKey)}
                  <span className="absolute bottom-0 left-1/2 -translate-x-1/2 w-0 h-0.5 bg-[#ba3d3d] group-hover:w-1/2 transition-all duration-300 rounded-full" />
                </a>
              ))}
          </div>

          <div className="hidden lg:flex items-center gap-3">
            <LanguagePicker />
            {AUTH_MAINTENANCE ? null : (
              <>
                <Link
                  href="/login"
                  className="px-4 py-2 text-sm font-medium text-gray-600 hover:text-[#ba3d3d] transition-colors"
                >
                  {t('navigation.logIn')}
                </Link>
                <Button
                  size="sm"
                  variant="secondary"
                  type="button"
                  onClick={() => router.push('/dashboard')}
                  className="bg-gray-100 hover:bg-gray-200"
                >
                  {t('navigation.dashboard')}
                </Button>
              </>
            )}
            {CTA_PAUSED_NOW ? (
              <PausedCta className={cn(buttonVariants({ size: 'sm' }), 'shadow-lg shadow-[#ba3d3d]/30')} />
            ) : AUTH_MAINTENANCE ? (
              <a
                href={CALCOM_BOOKING_URL}
                target="_blank"
                rel="noopener noreferrer"
                className={cn(buttonVariants({ size: 'sm' }), 'shadow-lg shadow-[#ba3d3d]/30 hover:shadow-xl hover:shadow-[#ba3d3d]/40 transition-all')}
              >
                {t('footer.label.getStarted')}
              </a>
            ) : (
              <Button
                size="sm"
                type="button"
                onClick={() => router.push(publicHref('/request-website', locale))}
                className="shadow-lg shadow-[#ba3d3d]/30 hover:shadow-xl hover:shadow-[#ba3d3d]/40 transition-all"
              >
                {t('footer.label.getStarted')}
              </Button>
            )}
          </div>

          <motion.button
            whileTap={{ scale: 0.95 }}
            onClick={() => setIsOpen(!isOpen)}
            className="lg:hidden inline-flex items-center justify-center min-h-11 min-w-11 p-2 text-gray-600 hover:text-[#ba3d3d] transition-colors rounded-xl hover:bg-gray-100"
            aria-label={t('navigation.ariaLabel.toggleMenu')}
          >
            {isOpen ? <X size={24} /> : <Menu size={24} />}
          </motion.button>
        </div>

        <motion.div
          initial={false}
          animate={{ 
            height: isOpen ? 'auto' : 0,
            opacity: isOpen ? 1 : 0
          }}
          transition={{ duration: 0.3, ease: 'easeInOut' }}
          className="lg:hidden overflow-hidden"
        >
          <div className="py-4 space-y-2 border-t border-gray-100">
            <motion.a
              href={publicHref('/#hero', locale)}
              onClick={() => setIsOpen(false)}
              className="block px-4 py-3 min-h-11 text-gray-600 hover:text-[#ba3d3d] hover:bg-[#ba3d3d]/5 transition-colors font-medium rounded-xl"
            >
              {t('navigation.label.home')}
            </motion.a>
            <button
              type="button"
              onClick={() => setMerchOpen((v) => !v)}
              className="w-full text-left px-4 py-3 min-h-11 text-gray-600 hover:text-[#ba3d3d] hover:bg-[#ba3d3d]/5 transition-colors font-medium rounded-xl"
              aria-expanded={merchOpen}
            >
              {t('navigation.label.merchandise')}
            </button>
            {merchOpen
              ? merchLinks.map((link) => (
                  <Link
                    key={link.slug}
                    href={publicHref(`/merch/${link.slug}`, locale)}
                    onClick={() => {
                      setIsOpen(false)
                      setMerchOpen(false)
                    }}
                    className="block pl-8 pr-4 py-2.5 min-h-11 text-sm text-gray-600 hover:text-[#ba3d3d] hover:bg-[#ba3d3d]/5 rounded-xl"
                  >
                    {link.label}
                  </Link>
                ))
              : null}
            {shopNav ? (
              <Link
                href={publicHref('/shop', locale)}
                onClick={() => setIsOpen(false)}
                className="block px-4 py-3 min-h-11 text-gray-600 hover:text-[#ba3d3d] hover:bg-[#ba3d3d]/5 transition-colors font-medium rounded-xl"
              >
                {t('navigation.label.shop')}
              </Link>
            ) : null}
            {navLinks
              .filter((link) => link.labelKey !== 'navigation.label.home')
              .map((link, index) => (
                <motion.a
                  key={link.labelKey}
                  href={publicHref(link.href, locale)}
                  onClick={() => setIsOpen(false)}
                  initial={{ opacity: 0, x: -20 }}
                  animate={isOpen ? { opacity: 1, x: 0 } : {}}
                  transition={{ delay: (index + 1) * 0.05 }}
                  className="block px-4 py-3 min-h-11 text-gray-600 hover:text-[#ba3d3d] hover:bg-[#ba3d3d]/5 transition-colors font-medium rounded-xl"
                >
                  {t(link.labelKey)}
                </motion.a>
              ))}
            <div className="pt-4 mt-4 border-t border-gray-100 space-y-3">
              {AUTH_MAINTENANCE ? null : (
              <Link
                href="/login"
                onClick={() => setIsOpen(false)}
                className="block px-4 py-3 min-h-11 text-gray-600 hover:text-[#ba3d3d] hover:bg-[#ba3d3d]/5 transition-colors font-medium rounded-xl"
              >
                {t('navigation.logIn')}
              </Link>
              )}
              <LanguagePicker className="px-4" />
              <div className="px-4 flex gap-3">
                {CTA_PAUSED_NOW ? (
                  <PausedCta className={cn(buttonVariants({ size: 'sm' }), 'flex-1')} />
                ) : AUTH_MAINTENANCE ? (
                  <a
                    href={CALCOM_BOOKING_URL}
                    target="_blank"
                    rel="noopener noreferrer"
                    onClick={() => setIsOpen(false)}
                    className={cn(buttonVariants({ size: 'sm' }), 'flex-1')}
                  >
                    {t('footer.label.getStarted')}
                  </a>
                ) : (
                  <>
                <Button
                  size="sm"
                  variant="secondary"
                  className="flex-1"
                  type="button"
                  onClick={() => {
                    setIsOpen(false)
                    router.push('/dashboard')
                  }}
                >
                  {t('navigation.dashboard')}
                </Button>
                <Button
                  size="sm"
                  className="flex-1"
                  type="button"
                  onClick={() => {
                    setIsOpen(false)
                    router.push(publicHref('/request-website', locale))
                  }}
                >
                  {t('footer.label.getStarted')}
                </Button>
                  </>
                )}
              </div>
            </div>
          </div>
        </motion.div>
      </div>
    </motion.nav>
  )
}
