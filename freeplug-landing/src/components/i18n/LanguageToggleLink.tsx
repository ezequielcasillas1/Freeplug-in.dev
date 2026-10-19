'use client'

import { useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { useLocale } from 'next-intl'
import { saveLocalePreference } from '@/app/language-actions'
import { LOCALE_LABELS, toAppLocale, type AppLocale } from '@/i18n/config'
import { spanishEnabled } from '@/i18n/gate'
import { cn } from '@/lib/utils/cn'

/**
 * Dashboard header switch (Lina's final placement, Oct 10): one plain text link naming the OTHER
 * language in its own language ("Español" on English pages, "English" on Spanish pages). No flag or
 * icon. Saves like LanguagePicker (profiles.locale, then the cookie) and re-renders in place.
 */
export function LanguageToggleLink({ className }: { className?: string }) {
  const locale = toAppLocale(useLocale())
  const router = useRouter()
  const [pending, startTransition] = useTransition()
  if (!spanishEnabled()) return null
  const other: AppLocale = locale === 'es' ? 'en' : 'es'

  return (
    <button
      type="button"
      lang={other}
      data-testid="language-toggle"
      disabled={pending}
      onClick={() =>
        startTransition(async () => {
          const res = await saveLocalePreference(other)
          if (res.ok) router.refresh()
        })
      }
      className={cn('whitespace-nowrap text-sm font-medium text-gray-600 hover:text-[#ba3d3d]', className)}
    >
      {LOCALE_LABELS[other]}
    </button>
  )
}
