import Link from 'next/link'
import { getTranslations, setRequestLocale } from 'next-intl/server'
import { MerchPageChrome } from '@/features/merch/components/MerchPageChrome'
import { toAppLocale } from '@/i18n/config'
import { publicHref } from '@/i18n/routing'
import { MERCH_TSHIRT_MAIN_CLASS } from '@/features/merch/merch-main-layout'

export default async function MerchCollectionSuccessPage({
  params,
}: {
  params: Promise<{ locale: string; collection: string; slug: string }>
}) {
  const { locale: loc, collection, slug } = await params
  const locale = toAppLocale(loc)
  setRequestLocale(locale)
  const t = await getTranslations({ locale, namespace: 'public.merch.collections' })

  return (
    <MerchPageChrome>
      <main className={MERCH_TSHIRT_MAIN_CLASS}>
        <div className="max-w-xl mx-auto px-4 sm:px-6 text-center min-w-0">
          <h1 className="text-2xl sm:text-3xl font-bold text-gray-900 mb-4">{t('successHeading')}</h1>
          <p className="text-gray-600 mb-8">{t('successLead')}</p>
          <Link
            href={publicHref(`/merch/${collection}/${slug}`, locale)}
            className="inline-flex min-h-11 items-center justify-center rounded-xl bg-[#ba3d3d] px-6 text-white font-semibold hover:bg-[#a03535]"
          >
            {t('successBack')}
          </Link>
        </div>
      </main>
    </MerchPageChrome>
  )
}
