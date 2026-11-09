import Link from 'next/link'
import { getTranslations, setRequestLocale } from 'next-intl/server'
import { MerchPageChrome } from '@/features/merch/components/MerchPageChrome'
import { toAppLocale } from '@/i18n/config'
import { publicHref } from '@/i18n/routing'

export default async function MerchShirtSuccessPage({ params }: { params: Promise<{ locale: string; slug: string }> }) {
  const { locale: loc, slug } = await params
  const locale = toAppLocale(loc)
  setRequestLocale(locale)
  const t = await getTranslations({ locale, namespace: 'public.merch.tshirts' })

  return (
    <MerchPageChrome>
      <main className="min-h-screen min-w-0 bg-gradient-to-b from-white to-zinc-50 pt-6 sm:pt-8 pb-16 px-4">
        <div className="max-w-lg mx-auto text-center min-w-0">
          <h1 className="text-2xl font-bold text-gray-900 mb-4">{t('successHeading')}</h1>
          <p className="text-gray-600 mb-6">{t('successLead')}</p>
          <Link
            href={publicHref(`/merch/t-shirts/${slug}`, locale)}
            className="inline-flex min-h-[44px] items-center justify-center rounded-xl bg-[#ba3d3d] px-6 text-white font-semibold hover:bg-[#a03535]"
          >
            {t('successBack')}
          </Link>
        </div>
      </main>
    </MerchPageChrome>
  )
}
