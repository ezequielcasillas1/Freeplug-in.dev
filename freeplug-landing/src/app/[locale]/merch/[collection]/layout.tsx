import type { Metadata } from 'next'
import { notFound } from 'next/navigation'
import { getTranslations, setRequestLocale } from 'next-intl/server'
import { ogLocale, publicAlternates } from '@/i18n/seo'
import { toAppLocale } from '@/i18n/config'
import { MERCH_COLLECTIONS, type MerchCollectionSlug } from '@/lib/merch/collections/catalog'

function isMerchCollection(value: string): value is MerchCollectionSlug {
  return (MERCH_COLLECTIONS as readonly string[]).includes(value)
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string; collection: string }>
}): Promise<Metadata> {
  const { locale: loc, collection } = await params
  if (!isMerchCollection(collection)) return {}
  const locale = toAppLocale(loc)
  const t = await getTranslations({ locale, namespace: 'public.merch.collections.meta' })
  const title = t(`${collection}Title`)
  const description = t(`${collection}Description`)
  const path = `/merch/${collection}`
  return {
    title,
    description,
    robots: { index: true, follow: true },
    ...publicAlternates(path, locale),
    openGraph: { title, description, type: 'website', ...ogLocale(locale) },
  }
}

export default async function MerchCollectionLayout({
  children,
  params,
}: {
  children: React.ReactNode
  params: Promise<{ locale: string; collection: string }>
}) {
  const { locale: loc, collection } = await params
  if (!isMerchCollection(collection)) notFound()
  setRequestLocale(toAppLocale(loc))
  return children
}
