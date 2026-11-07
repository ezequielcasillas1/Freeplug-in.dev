import type { Metadata } from 'next'
import { getTranslations, setRequestLocale } from 'next-intl/server'
import { ogLocale, publicAlternates } from '@/i18n/seo'
import { toAppLocale } from '@/i18n/config'

const PATH = '/merch/fonts-personal-use'

export async function generateMetadata({ params }: { params: Promise<{ locale: string }> }): Promise<Metadata> {
  const locale = toAppLocale((await params).locale)
  const t = await getTranslations({ locale, namespace: 'public.merch.meta' })
  const title = t('personalUseTitle')
  const description = t('personalUseDescription')
  return {
    title,
    description,
    robots: { index: true, follow: true },
    ...publicAlternates(PATH, locale),
    openGraph: { title, description, type: 'website', ...ogLocale(locale) },
  }
}

export default async function PersonalUseLayout({ children, params }: { children: React.ReactNode; params: Promise<{ locale: string }> }) {
  setRequestLocale(toAppLocale((await params).locale))
  return children
}
