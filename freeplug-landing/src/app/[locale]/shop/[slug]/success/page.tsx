'use client'

import Link from 'next/link'
import { useLocale, useTranslations } from 'next-intl'
import { toAppLocale } from '@/i18n/config'
import { publicHref } from '@/i18n/routing'
import { MerchPageChrome } from '@/features/merch/components/MerchPageChrome'
import { useParams } from 'next/navigation'

export default function ShopSuccessPage() {
  const t = useTranslations('public.merch.shop')
  const locale = toAppLocale(useLocale())
  const params = useParams<{ slug: string }>()

  return (
    <MerchPageChrome>
      <main className="min-h-screen bg-gradient-to-b from-white to-zinc-50 pt-10 pb-16">
        <div className="max-w-xl mx-auto px-4 text-center">
          <h1 className="text-3xl font-bold text-gray-900 mb-3">{t('successHeading')}</h1>
          <p className="text-gray-600 mb-8">{t('successLead')}</p>
          <Link
            href={publicHref(`/shop/${params.slug}`, locale)}
            className="inline-flex rounded-xl bg-[#ba3d3d] text-white px-5 py-3 font-semibold hover:bg-[#a33434]"
          >
            {t('successBack')}
          </Link>
        </div>
      </main>
    </MerchPageChrome>
  )
}
