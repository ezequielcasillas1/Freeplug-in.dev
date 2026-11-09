import type { Metadata } from 'next'
import { notFound } from 'next/navigation'
import { getTranslations, setRequestLocale } from 'next-intl/server'
import { ogLocale, publicAlternates } from '@/i18n/seo'
import { toAppLocale } from '@/i18n/config'
import { isMerchShopEnabled } from '@/lib/merch/flags'

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>
}): Promise<Metadata> {
  const { locale: loc } = await params
  const locale = toAppLocale(loc)
  const t = await getTranslations({ locale, namespace: 'public.merch.shop.meta' })
  const path = '/shop'
  return {
    title: t('indexTitle'),
    description: t('indexDescription'),
    robots: { index: true, follow: true },
    ...publicAlternates(path, locale),
    openGraph: { title: t('indexTitle'), description: t('indexDescription'), type: 'website', ...ogLocale(locale) },
  }
}

export default async function ShopLayout({
  children,
  params,
}: {
  children: React.ReactNode
  params: Promise<{ locale: string }>
}) {
  if (!isMerchShopEnabled()) notFound()
  const { locale: loc } = await params
  setRequestLocale(toAppLocale(loc))
  return children
}
