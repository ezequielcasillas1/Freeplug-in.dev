import type { Metadata } from 'next'
import { getTranslations, setRequestLocale } from 'next-intl/server'
import {
  MERCH_COLLECTIONS,
  getCatalogProduct,
  type MerchCollectionSlug,
} from '@/lib/merch/collections/catalog'
import { ogLocale, publicAlternates } from '@/i18n/seo'
import { toAppLocale } from '@/i18n/config'

function isMerchCollection(value: string): value is MerchCollectionSlug {
  return (MERCH_COLLECTIONS as readonly string[]).includes(value)
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string; collection: string; slug: string }>
}): Promise<Metadata> {
  const { locale: loc, collection, slug } = await params
  if (!isMerchCollection(collection)) return {}
  const entry = getCatalogProduct(slug)
  if (!entry || entry.collection !== collection) return {}
  const locale = toAppLocale(loc)
  const t = await getTranslations({ locale, namespace: 'public.merch.collections' })
  const title = `${t(`products.${entry.title_key}`)} | Freeplug Merch`
  const description = t(`productDetails.${entry.title_key}`)
  const path = `/merch/${collection}/${slug}`
  return {
    title,
    description,
    robots: { index: true, follow: true },
    ...publicAlternates(path, locale),
    openGraph: { title, description, type: 'website', ...ogLocale(locale) },
  }
}

export default async function CollectionProductLayout({
  children,
  params,
}: {
  children: React.ReactNode
  params: Promise<{ locale: string }>
}) {
  setRequestLocale(toAppLocale((await params).locale))
  return children
}
