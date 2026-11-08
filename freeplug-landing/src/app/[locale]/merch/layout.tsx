import type { Metadata } from 'next'
import { getTranslations, setRequestLocale } from 'next-intl/server'
import { ogLocale, publicAlternates } from '@/i18n/seo'
import { toAppLocale } from '@/i18n/config'
import '@/features/merch/merch-mobile-specimen.css'

export async function generateMetadata({ params }: { params: Promise<{ locale: string }> }): Promise<Metadata> {
  const locale = toAppLocale((await params).locale)
  const t = await getTranslations({ locale, namespace: 'public.merch.meta' })
  const title = t('indexTitle')
  const description = t('indexDescription')
  return {
    title,
    description,
    robots: { index: true, follow: true },
    ...publicAlternates('/merch', locale),
    openGraph: { title, description, type: 'website', ...ogLocale(locale) },
  }
}

export default async function MerchLayout({ children, params }: { children: React.ReactNode; params: Promise<{ locale: string }> }) {
  setRequestLocale(toAppLocale((await params).locale))
  return <div className="merch-font-preview min-w-0 overflow-x-clip">{children}</div>
}
