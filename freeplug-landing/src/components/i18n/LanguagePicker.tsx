'use client'

import { useTransition } from 'react'
import { usePathname, useRouter } from 'next/navigation'
import { useLocale, useTranslations } from 'next-intl'
import { saveLocalePreference } from '@/app/language-actions'
import { LOCALE_LABELS, LOCALES, toAppLocale, type AppLocale } from '@/i18n/config'
import { spanishEnabled } from '@/i18n/gate'
import { localizedPath, isLocalizedPublicPath } from '@/i18n/routing'
import { cn } from '@/lib/utils/cn'

/**
 * "English" / "Español" (card R4): each label in its own language, no flags.
 * - Public pages: goes to the same page in the other language ('/faq' <-> '/es/faq').
 * - App pages (dashboard, login, claim): stays on the page and re-renders in the new language.
 * Either way the choice is saved (cookie, and profiles.locale when signed in).
 * Gate OFF -> renders nothing (§6 case 12).
 */
export function LanguagePicker({ className, variant = 'light' }: { className?: string; variant?: 'light' | 'dark' }) {
  const locale = toAppLocale(useLocale())
  const pathname = usePathname() ?? '/'
  const router = useRouter()
  const [pending, startTransition] = useTransition()
  const t = useTranslations('i18n.picker')
  if (!spanishEnabled()) return null

  const choose = (next: AppLocale) => {
    if (next === locale || pending) return
    startTransition(async () => {
      await saveLocalePreference(next)
      if (isLocalizedPublicPath(pathname)) router.push(localizedPath(pathname, next))
      else router.refresh()
    })
  }

  return (
    <div
      role="group"
      aria-label={t('label')}
      data-testid="language-picker"
      className={cn('inline-flex items-center gap-1 text-sm', className)}
    >
      {LOCALES.map((l, i) => (
        <span key={l} className="inline-flex items-center gap-1">
          {i > 0 ? <span aria-hidden className={variant === 'dark' ? 'text-gray-500' : 'text-gray-300'}>|</span> : null}
          <button
            type="button"
            lang={l}
            aria-pressed={l === locale}
            disabled={pending}
            onClick={() => choose(l)}
            className={cn(
              'rounded px-1.5 py-0.5 whitespace-nowrap',
              l === locale
                ? 'font-semibold text-[#ba3d3d]'
                : variant === 'dark'
                  ? 'text-gray-300 hover:text-white'
                  : 'text-gray-600 hover:text-gray-900'
            )}
          >
            {LOCALE_LABELS[l]}
          </button>
        </span>
      ))}
    </div>
  )
}
