'use client'

import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { ArrowRight } from 'lucide-react'
import { Button, buttonVariants } from '@/components/ui/button'
import { cn } from '@/lib/utils/cn'
import { useLocale, useTranslations } from 'next-intl'
import { toAppLocale } from '@/i18n/config'
import { publicHref } from '@/i18n/routing'
import { isPublicSignupOpen } from '@/lib/launch/public-signup-open'

type Variant = 'nav' | 'hero' | 'cta' | 'footer'

const pausedClass =
  'opacity-60 pointer-events-none cursor-not-allowed shadow-lg shadow-[#ba3d3d]/20'

export function PublicSignupCta({ variant }: { variant: Variant }) {
  const t = useTranslations('public.landing')
  const locale = toAppLocale(useLocale())
  const router = useRouter()
  const open = isPublicSignupOpen()

  if (!open) {
    const label = t('navigation.signupPaused')
    if (variant === 'nav') {
      return (
        <Button
          size="sm"
          type="button"
          disabled
          data-testid="cta-paused"
          className={cn(pausedClass)}
          aria-disabled="true"
        >
          {label}
        </Button>
      )
    }
    if (variant === 'hero') {
      return (
        <span
          data-testid="cta-paused"
          className={cn(
            buttonVariants({ size: 'lg' }),
            pausedClass,
            'text-base px-8 border-0 inline-flex items-center'
          )}
        >
          {label}
        </span>
      )
    }
    if (variant === 'cta') {
      return (
        <span
          data-testid="cta-paused"
          className={cn(
            buttonVariants({ size: 'lg' }),
            'bg-white/80 text-[#ba3d3d] px-8 border-0 inline-flex items-center',
            pausedClass
          )}
        >
          {label}
        </span>
      )
    }
    return (
      <span className="text-gray-500 text-sm" data-testid="cta-paused">
        {label}
      </span>
    )
  }

  const label =
    variant === 'footer'
      ? t('footer.label.getStarted')
      : variant === 'nav'
        ? t('footer.label.getStarted')
        : t('cTA.requestFreeWebsite')

  const onSignup = () => router.push(publicHref('/signup', locale))

  if (variant === 'nav') {
    return (
      <Button
        size="sm"
        type="button"
        onClick={onSignup}
        className="shadow-lg shadow-[#ba3d3d]/30 hover:shadow-xl hover:shadow-[#ba3d3d]/40 transition-all"
      >
        {label}
      </Button>
    )
  }

  if (variant === 'footer') {
    return (
      <Link
        href={publicHref('/signup', locale)}
        className="text-gray-400 hover:text-white transition-colors text-sm flex items-center gap-1 group"
      >
        {label}
      </Link>
    )
  }

  if (variant === 'cta') {
    return (
      <Link
        href={publicHref('/signup', locale)}
        className={cn(
          buttonVariants({ size: 'lg' }),
          'bg-white text-[#ba3d3d] hover:bg-gray-100 group shadow-xl shadow-black/20 hover:shadow-2xl hover:shadow-black/30 transition-all px-8 border-0'
        )}
      >
        {label}
        <ArrowRight size={20} className="ml-2 group-hover:translate-x-1 transition-transform" />
      </Link>
    )
  }

  return (
    <Link
      href={publicHref('/signup', locale)}
      className={cn(
        buttonVariants({ size: 'lg' }),
        'group relative overflow-hidden bg-gradient-to-r from-[#ba3d3d] to-[#8a2e2e] shadow-[0_8px_32px_rgba(186,61,61,0.35)] hover:shadow-[0_12px_40px_rgba(186,61,61,0.45)] transition-all duration-300 text-base px-8 border-0'
      )}
    >
      <span className="relative z-10 flex items-center">
        {label}
        <ArrowRight size={18} className="ml-2 group-hover:translate-x-1 transition-transform" />
      </span>
    </Link>
  )
}
