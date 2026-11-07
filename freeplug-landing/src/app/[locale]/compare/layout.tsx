import type { Metadata } from 'next'
import { getTranslations, setRequestLocale } from 'next-intl/server'
import { ogLocale, publicAlternates } from '@/i18n/seo'
import { toAppLocale } from '@/i18n/config'

export async function generateMetadata({ params }: { params: Promise<{ locale: string }> }): Promise<Metadata> {
  const locale = toAppLocale((await params).locale)
  const t = await getTranslations({ locale, namespace: 'public.compare' })
  const title = t('compareTitle')
  const description = t('compareDescription')
  return {
    title,
    description,
    ...publicAlternates('/compare', locale),
    openGraph: { title, description, type: 'website', ...ogLocale(locale) },
  }
}

export default async function CompareLayout({
  children,
  params,
}: {
  children: React.ReactNode
  params: Promise<{ locale: string }>
}) {
  setRequestLocale(toAppLocale((await params).locale))
  return children
}
