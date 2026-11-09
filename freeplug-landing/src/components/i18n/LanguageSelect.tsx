'use client'

import { useId, useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { useLocale, useTranslations } from 'next-intl'
import { saveLocalePreference } from '@/app/language-actions'
import { LOCALE_LABELS, LOCALES, isAppLocale, toAppLocale } from '@/i18n/config'
import { spanishEnabled } from '@/i18n/gate'
import { cn } from '@/lib/utils/cn'

/**
 * Settings row (Lina, Oct 10): "Language" / "Idioma" with an English / Español select. Saves on
 * change (no Save button) and shows a small gray "Saved" / "Guardado". Gate OFF -> nothing.
 */
export function LanguageSelect({ className }: { className?: string }) {
  const locale = toAppLocale(useLocale())
  const router = useRouter()
  const [pending, startTransition] = useTransition()
  const [saved, setSaved] = useState(false)
  const t = useTranslations('dashboard.settings.language')
  const id = useId()
  if (!spanishEnabled()) return null

  return (
    <div className={cn('flex flex-wrap items-center gap-3', className)} data-testid="language-select">
      <label htmlFor={id} className="text-sm font-medium text-gray-900">
        {t('label')}
      </label>
      <select
        id={id}
        value={locale}
        disabled={pending}
        onChange={(e) => {
          const next = e.target.value
          if (!isAppLocale(next) || next === locale) return
          setSaved(false)
          startTransition(async () => {
            const res = await saveLocalePreference(next)
            if (res.ok) {
              setSaved(true)
              router.refresh()
            }
          })
        }}
        className="rounded-md border border-zinc-300 bg-white px-3 py-2 text-sm text-gray-900"
      >
        {LOCALES.map((l) => (
          <option key={l} value={l} lang={l}>
            {LOCALE_LABELS[l]}
          </option>
        ))}
      </select>
      {saved && !pending ? (
        <span role="status" className="text-xs text-gray-500" data-testid="language-saved">
          {t('saved')}
        </span>
      ) : null}
    </div>
  )
}
