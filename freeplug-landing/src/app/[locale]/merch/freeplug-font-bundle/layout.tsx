import type { Metadata } from 'next'
import { getTranslations, setRequestLocale } from 'next-intl/server'
import { ogLocale, publicAlternates } from '@/i18n/seo'
import { toAppLocale } from '@/i18n/config'
import { ProductJsonLd } from '@/features/merch/components/ProductJsonLd'

const PATH = '/merch/freeplug-font-bundle'

export async function generateMetadata({ params }: { params: Promise<{ locale: string }> }): Promise<Metadata> {
  const locale = toAppLocale((await params).locale)
  const t = await getTranslations({ locale, namespace: 'public.merch.meta' })
  const title = t('productTitle')
  const description = t('productDescription')
  return {
    title,
    description,
    robots: { index: true, follow: true },
    ...publicAlternates(PATH, locale),
    openGraph: {
      title,
      description,
      type: 'website',
      images: [{ url: '/images/merch/specimen-fp-cursive.png' }],
      ...ogLocale(locale),
    },
  }
}

export default async function FontBundleLayout({ children, params }: { children: React.ReactNode; params: Promise<{ locale: string }> }) {
  const locale = toAppLocale((await params).locale)
  setRequestLocale(locale)
  const t = await getTranslations({ locale, namespace: 'public.merch.meta' })
  const name = t('productTitle').replace(/\s*\|\s*Freeplug$/, '')
  return (
    <>
      <ProductJsonLd name={name} description={t('productDescription')} localePath={PATH} />
      {children}
    </>
  )
}
