import type { Metadata } from 'next'
import { getTranslations, setRequestLocale } from 'next-intl/server'
import { getShopItem } from '@/lib/merch/shop/catalog'
import { ogLocale, publicAlternates } from '@/i18n/seo'
import { toAppLocale } from '@/i18n/config'

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string; slug: string }>
}): Promise<Metadata> {
  const { locale: loc, slug } = await params
  const locale = toAppLocale(loc)
  const item = getShopItem(slug)
  if (!item) return {}
  const t = await getTranslations({ locale, namespace: 'public.merch.shop.meta' })
  const title = t('productTitle', { name: item.title })
  const description = t('productDescription', { name: item.title })
  const path = `/shop/${slug}`
  return {
    title,
    description,
    robots: { index: true, follow: true },
    ...publicAlternates(path, locale),
    openGraph: { title, description, type: 'website', ...ogLocale(locale) },
  }
}

export default async function ShopProductLayout({
  children,
  params,
}: {
  children: React.ReactNode
  params: Promise<{ locale: string }>
}) {
  setRequestLocale(toAppLocale((await params).locale))
  return children
}
