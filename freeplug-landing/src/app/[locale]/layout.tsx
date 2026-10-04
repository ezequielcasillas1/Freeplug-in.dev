import type { Metadata } from 'next'
import { notFound } from 'next/navigation'
import { hasLocale } from 'next-intl'
import { getMessages, getTranslations, setRequestLocale } from 'next-intl/server'
import { AppDocument } from '@/app/AppDocument'
import { LanguageBanner, type BannerStrings } from '@/components/i18n/LanguageBanner'
import { spanishEnabled } from '@/i18n/gate'
import { SpanishPendingError } from '@/i18n/messages'
import type { AppLocale } from '@/i18n/config'
import type { Messages } from '@/i18n/messages'
import { routing } from '@/i18n/routing'
import { ogLocale } from '@/i18n/seo'

/**
 * Public, indexable pages: '/', '/faq', '/signup', '/request-website' (English, unprefixed via the
 * proxy rewrite) and their /es twins when the Spanish gate is ON. Gate OFF -> only 'en' exists and
 * /es is a 404 (dynamicParams = false). Pages stay statically rendered (setRequestLocale).
 */
export const dynamicParams = false

export function generateStaticParams() {
  return routing.locales.map((locale) => ({ locale }))
}

type Props = { children: React.ReactNode; params: Promise<{ locale: string }> }

export async function generateMetadata({ params }: Omit<Props, 'children'>): Promise<Metadata> {
  const { locale } = await params
  if (!hasLocale(routing.locales, locale)) return {}
  const t = await getTranslations({ locale, namespace: 'public.meta' })
  return {
    title: { default: t('siteTitle'), template: '%s' },
    description: t('siteDescription'),
    openGraph: { title: t('ogTitle'), description: t('ogDescription'), type: 'website', ...ogLocale(locale as AppLocale) },
  }
}

export default async function LocaleLayout({ children, params }: Props) {
  const { locale } = await params
  if (!hasLocale(routing.locales, locale)) notFound()
  setRequestLocale(locale)
  const messages = (await getMessages()) as Messages
  const bannerStrings = locale === 'en' ? await spanishBannerStrings() : null
  return (
    <AppDocument lang={locale as AppLocale} messages={messages}>
      {children}
      <LanguageBanner pageLocale={locale as AppLocale} strings={bannerStrings} />
    </AppDocument>
  )
}

/** The banner speaks Spanish on English pages, so its strings come from the es catalog (gate ON only). */
async function spanishBannerStrings(): Promise<BannerStrings | null> {
  if (!spanishEnabled()) return null
  try {
    const t = await getTranslations({ locale: 'es', namespace: 'i18n.banner' })
    return { prompt: t('prompt'), dismiss: t('dismiss') }
  } catch (e) {
    if (e instanceof SpanishPendingError) return null
    throw e
  }
}
