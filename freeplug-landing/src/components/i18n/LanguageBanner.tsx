'use client'

import { useEffect, useState } from 'react'
import { usePathname, useRouter } from 'next/navigation'
import { saveLocalePreference } from '@/app/language-actions'
import { LOCALE_COOKIE, LOCALE_COOKIE_MAX_AGE, LOCALE_LABELS, type AppLocale } from '@/i18n/config'
import { spanishEnabled } from '@/i18n/gate'
import { localizedPath } from '@/i18n/routing'

export type BannerStrings = { prompt: string; dismiss: string }

/** True when the browser prefers Spanish and the visitor has not chosen a language yet. */
export function shouldOfferSpanish(languages: readonly string[], cookie: string): boolean {
  const hasChoice = cookie.split(';').some((c) => c.trim().startsWith(`${LOCALE_COOKIE}=`))
  const first = (languages[0] ?? '').toLowerCase()
  return !hasChoice && (first === 'es' || first.startsWith('es-'))
}

/**
 * "Prefer Spanish?" banner (card R4). Never a redirect. Client-only: it renders nothing on the
 * server and nothing until mounted, so the HTML is identical for every visitor and crawler (§6
 * case 3) and the prerendered page stays cacheable. Dismiss sets NEXT_LOCALE=en for a year.
 * Shown only on English public pages, with the gate ON, and only when Spanish strings exist.
 */
export function LanguageBanner({ pageLocale, strings }: { pageLocale: AppLocale; strings?: BannerStrings | null }) {
  const [show, setShow] = useState(false)
  const pathname = usePathname() ?? '/'
  const router = useRouter()

  useEffect(() => {
    if (!spanishEnabled() || pageLocale !== 'en' || !strings) return
    // Deferred so the first client render matches the server HTML exactly.
    const id = window.setTimeout(() => setShow(shouldOfferSpanish(navigator.languages ?? [navigator.language], document.cookie)), 0)
    return () => window.clearTimeout(id)
  }, [pageLocale, strings])

  if (!show || !strings) return null

  const dismiss = () => {
    document.cookie = `${LOCALE_COOKIE}=en; Path=/; Max-Age=${LOCALE_COOKIE_MAX_AGE}; SameSite=Lax`
    setShow(false)
  }
  const switchToSpanish = async () => {
    await saveLocalePreference('es')
    router.push(localizedPath(pathname, 'es'))
  }

  return (
    <div
      lang="es"
      role="region"
      aria-label={strings.prompt}
      data-testid="language-banner"
      className="fixed bottom-4 left-1/2 z-50 flex w-[calc(100%-2rem)] max-w-md -translate-x-1/2 items-center justify-between gap-2 rounded-xl border border-zinc-200 bg-white px-3 py-3 text-sm shadow-lg"
    >
      {/* One row at 375 (Lina): the prompt stays on one line; buttons keep their size. */}
      <span data-testid="language-banner-prompt" className="min-w-0 whitespace-nowrap text-gray-800">{strings.prompt}</span>
      <span className="flex shrink-0 items-center gap-1">
        <button type="button" onClick={switchToSpanish} className="rounded-lg bg-[#ba3d3d] px-3 py-1.5 font-medium text-white hover:bg-[#a53434]">
          {LOCALE_LABELS.es}
        </button>
        <button type="button" onClick={dismiss} className="rounded-lg px-2 py-1.5 text-gray-600 hover:text-gray-900">
          {strings.dismiss}
        </button>
      </span>
    </div>
  )
}
