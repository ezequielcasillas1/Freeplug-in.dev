import Link from 'next/link'
import { translatorFor } from '@/i18n/translate'
import { Navigation } from '@/features/landing/components/Navigation'
import { Footer } from '@/features/landing/components/Footer'
import type { AppLocale } from '@/i18n/config'
import { localizedPath } from '@/i18n/routing'

/** Custom 404 (Wren G16): same nav, footer and styling as the public pages, with a link home. */
/** Plain translator (no next-intl request scope): a not-found boundary must not read headers(). */
export function NotFoundView({ locale }: { locale: AppLocale }) {
  const t = translatorFor(locale, 'public.notFound')
  const homeHref = localizedPath('/', locale)
  return (
    <>
      <Navigation />
      <main className="relative min-h-[70vh] overflow-hidden bg-gradient-to-b from-white to-zinc-50">
        <div className="absolute top-0 right-0 w-96 h-96 bg-gradient-to-br from-[#ba3d3d]/5 to-transparent rounded-full blur-3xl -translate-y-1/2 translate-x-1/2" />
        <div className="relative max-w-3xl mx-auto px-4 sm:px-6 lg:px-8 pt-40 pb-24 text-center">
          <span className="inline-block px-4 py-1.5 rounded-full bg-[#ba3d3d]/10 text-[#ba3d3d] text-sm font-semibold uppercase tracking-wider mb-4">
            404
          </span>
          <h1 className="text-4xl sm:text-5xl font-bold text-gray-900 mb-8">{t('heading')}</h1>
          <Link
            href={homeHref}
            className="inline-flex items-center gap-2 px-6 py-3 rounded-xl bg-[#ba3d3d] text-white font-medium hover:bg-[#a53434] transition-colors"
          >
            {t('link')}
          </Link>
        </div>
      </main>
      <Footer />
    </>
  )
}
