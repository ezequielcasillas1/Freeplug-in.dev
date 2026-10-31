import type { Metadata } from 'next'
import { ShieldCheck } from 'lucide-react'
import { getTranslations, setRequestLocale } from 'next-intl/server'
import { Navigation } from '@/features/landing/components/Navigation'
import { Footer } from '@/features/landing/components/Footer'
import { ogLocale, publicAlternates } from '@/i18n/seo'
import { toAppLocale } from '@/i18n/config'
import { TranslationNotice } from '@/components/i18n/TranslationNotice'

type Props = { params: Promise<{ locale: string }> }
type Section = { h: string } & Record<string, string>

/** Same inline body-link style as the FAQ page's in-text link. */
const LINK_CLASS = 'font-medium text-[#ba3d3d] underline underline-offset-2 hover:text-[#9a3232]'
const richTags = {
  email: (chunks: React.ReactNode) => (
    <a href="mailto:support@freeplug-in.dev" className={LINK_CLASS}>
      {chunks}
    </a>
  ),
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const locale = toAppLocale((await params).locale)
  const t = await getTranslations({ locale, namespace: 'public.meta' })
  const title = t('privacyTitle')
  const description = t('privacyDescription')
  return {
    title,
    description,
    ...publicAlternates('/privacy', locale),
    openGraph: { title, description, type: 'website', ...ogLocale(locale) },
  }
}

/** Privacy policy (Oct 24 2026). Providers are named by category only, never by brand. Same shell as /faq. */
export default async function PrivacyPage({ params }: Props) {
  const locale = toAppLocale((await params).locale)
  setRequestLocale(locale)
  const t = await getTranslations({ locale, namespace: 'public.privacy' })
  // Each section is { h, p1, p2, ... } (plain strings, so the catalog stays a string tree).
  const sections = Object.entries(t.raw('sections') as Record<string, Section>)
  return (
    <>
      <Navigation />
      <main className="min-h-screen bg-gradient-to-b from-white to-zinc-50">
        <section className="py-24 relative overflow-hidden">
          <div className="absolute top-0 right-0 w-96 h-96 bg-gradient-to-br from-[#ba3d3d]/5 to-transparent rounded-full blur-3xl -translate-y-1/2 translate-x-1/2" />
          <div className="absolute bottom-0 left-0 w-96 h-96 bg-gradient-to-tr from-[#ba3d3d]/5 to-transparent rounded-full blur-3xl translate-y-1/2 -translate-x-1/2" />
          <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8 relative">
            <TranslationNotice className="mb-6 text-center text-gray-500" />
            <div className="text-center mb-12">
              <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-[#ba3d3d]/10 text-[#ba3d3d] text-sm font-semibold uppercase tracking-wider mb-4">
                <ShieldCheck className="w-4 h-4" />
                {t('badge')}
              </div>
              <h1 className="text-3xl sm:text-4xl lg:text-5xl font-bold text-gray-900 mb-4">{t('title')}</h1>
              <p className="text-sm text-gray-500 mb-4">{t('updated')}</p>
              <p className="text-lg text-gray-600 max-w-xl mx-auto">{t.rich('intro', richTags)}</p>
            </div>
            <div className="space-y-6">
              {sections.map(([id, s]) => (
                <section key={s.h} className="p-6 rounded-2xl bg-white border border-gray-200 shadow-sm">
                  <h2 className="text-xl font-bold text-gray-900 mb-3">{s.h}</h2>
                  <div className="space-y-3 text-gray-600 leading-relaxed">
                    {Object.keys(s).filter((k) => k !== 'h').map((k) => (
                      <p key={k}>{t.rich(`sections.${id}.${k}`, richTags)}</p>
                    ))}
                  </div>
                </section>
              ))}
            </div>
          </div>
        </section>
      </main>
      <Footer />
    </>
  )
}
