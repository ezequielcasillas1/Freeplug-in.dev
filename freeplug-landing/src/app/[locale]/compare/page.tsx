import type { Metadata } from 'next'
import { getTranslations, setRequestLocale } from 'next-intl/server'
import { Navigation } from '@/features/landing/components/Navigation'
import { Footer } from '@/features/landing/components/Footer'
import { ogLocale, publicAlternates, publicUrl } from '@/i18n/seo'
import { toAppLocale } from '@/i18n/config'
import { localizedPath, publicHref } from '@/i18n/routing'
import { TranslationNotice } from '@/components/i18n/TranslationNotice'
import { CompareTable } from '@/features/compare/CompareTable'
import { CompareCta } from '@/features/compare/CompareCta'

type Props = { params: Promise<{ locale: string }> }

// Title/description: public.meta.compareTitle / compareDescription (one place to edit).
export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const locale = toAppLocale((await params).locale)
  const t = await getTranslations({ locale, namespace: 'public.meta' })
  const title = t('compareTitle')
  const description = t('compareDescription')
  return {
    title,
    description,
    ...publicAlternates('/compare', locale),
    openGraph: { title, description, type: 'website', ...ogLocale(locale) },
  }
}

/** Full comparison (Oct 31, 2026): all companies open, same card layout on mobile. */
export default async function ComparePage({ params }: Props) {
  const locale = toAppLocale((await params).locale)
  setRequestLocale(locale)
  const t = await getTranslations({ locale, namespace: 'public.compare' })
  const breadcrumb = {
    '@context': 'https://schema.org',
    '@type': 'BreadcrumbList',
    itemListElement: [
      { '@type': 'ListItem', position: 1, name: t('breadcrumbHome'), item: publicUrl(localizedPath('/', locale)) },
      { '@type': 'ListItem', position: 2, name: t('breadcrumbCompare'), item: publicUrl(localizedPath('/compare', locale)) },
    ],
  }
  return (
    <>
      <Navigation />
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(breadcrumb) }} />
      <main className="min-h-screen bg-gradient-to-b from-white to-zinc-50">
        <section className="py-24">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            <TranslationNotice className="mb-6 text-center text-gray-500" />
            <div className="text-center mb-10 sm:mb-12">
              <h1 className="text-3xl sm:text-4xl lg:text-5xl font-bold text-gray-900 mb-4">{t('h1')}</h1>
              <p className="text-lg text-gray-600 max-w-3xl mx-auto">{t('subline')}</p>
            </div>
            <h2 className="text-2xl font-bold text-gray-900 mb-6">{t('ownHeading')}</h2>
            <CompareTable />
            <p className="mt-6 text-center text-sm text-gray-500">{t('footnote')}</p>
            <div className="mt-8 flex flex-col items-center gap-4">
              <CompareCta href={publicHref('/request-website', locale)} label={t('requestForm')} />
              <a href={publicHref('/#hosting-plans', locale)} className="text-sm font-semibold text-[#ba3d3d] hover:underline">{t('seePricing')}</a>
            </div>
          </div>
        </section>
      </main>
      <Footer />
    </>
  )
}
