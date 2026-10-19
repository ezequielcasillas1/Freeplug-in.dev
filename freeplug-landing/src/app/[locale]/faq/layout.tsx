import type { Metadata } from 'next'
import { getTranslations, setRequestLocale } from 'next-intl/server'
import { ogLocale, publicAlternates } from '@/i18n/seo'
import { toAppLocale } from '@/i18n/config'

// The FAQ page is a client component, so its metadata lives here (per locale, card R2).
// Own openGraph block: Next replaces (not merges) the root layout's openGraph, so set all fields.
export async function generateMetadata({ params }: { params: Promise<{ locale: string }> }): Promise<Metadata> {
  const locale = toAppLocale((await params).locale)
  const t = await getTranslations({ locale, namespace: 'public.meta' })
  const title = t('faqTitle')
  const description = t('faqDescription')
  return {
    title,
    description,
    ...publicAlternates('/faq', locale),
    openGraph: { title, description, type: 'website', ...ogLocale(locale) },
  }
}

export default async function FaqLayout({ children, params }: { children: React.ReactNode; params: Promise<{ locale: string }> }) {
  setRequestLocale(toAppLocale((await params).locale)) // keeps /faq and /es/faq static
  return children
}
