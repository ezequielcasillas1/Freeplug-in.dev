import type { Metadata } from 'next'
import { getTranslations, setRequestLocale } from 'next-intl/server'
import { getShirtBySlug } from '@/lib/merch/shirts/catalog'
import { ogLocale, publicAlternates } from '@/i18n/seo'
import { toAppLocale } from '@/i18n/config'

const TITLE_KEYS: Record<string, string> = {
  '01-know-a-plug': 'shirt01',
  '02-circle-mark': 'shirt02',
  '03-get-plugged-in': 'shirt03',
  '04-free-game': 'shirt04',
  '05-website-was-free': 'shirt05',
  '06-day-one': 'shirt06',
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string; slug: string }>
}): Promise<Metadata> {
  const { locale: loc, slug } = await params
  const locale = toAppLocale(loc)
  if (!getShirtBySlug(slug)) return {}
  const t = await getTranslations({ locale, namespace: 'public.merch.tshirts' })
  const key = TITLE_KEYS[slug] ?? slug
  const title = `${t(`products.${key}`)} | Freeplug Merch`
  const description = t('productMetaDescription')
  const path = `/merch/t-shirts/${slug}`
  return {
    title,
    description,
    robots: { index: true, follow: true },
    ...publicAlternates(path, locale),
    openGraph: { title, description, type: 'website', ...ogLocale(locale) },
  }
}

export default async function ShirtProductLayout({
  children,
  params,
}: {
  children: React.ReactNode
  params: Promise<{ locale: string }>
}) {
  setRequestLocale(toAppLocale((await params).locale))
  return children
}
