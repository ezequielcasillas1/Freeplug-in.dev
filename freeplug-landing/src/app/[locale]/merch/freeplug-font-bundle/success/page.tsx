'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { useSearchParams } from 'next/navigation'
import { MerchPageChrome } from '@/features/merch/components/MerchPageChrome'
import { useLocale, useTranslations } from 'next-intl'
import { toAppLocale } from '@/i18n/config'
import { publicHref } from '@/i18n/routing'
import { MERCH_FONT_BUNDLE_SLUG } from '@/lib/merch/product'

type TokenResponse = {
  status?: string
  token?: string
  downloadUrl?: string
  expiresAt?: string
  emailSent?: boolean
  emailPending?: boolean
  unavailable?: 'expired' | 'limit'
  supportEmail?: string
  error?: string
  mock?: boolean
}

export default function MerchSuccessPage() {
  const t = useTranslations('public.merch.success')
  const locale = toAppLocale(useLocale())
  const params = useSearchParams()
  const sessionId = params.get('session_id')
  const [data, setData] = useState<TokenResponse | null>(null)
  const [loading, setLoading] = useState(Boolean(sessionId))

  useEffect(() => {
    if (!sessionId) return
    let cancelled = false
    void (async () => {
      try {
        const res = await fetch(`/api/merch/session-token?session_id=${encodeURIComponent(sessionId)}`)
        const json = (await res.json()) as TokenResponse
        if (!cancelled) setData(json)
      } catch {
        if (!cancelled) setData({ error: t('loadError') })
      } finally {
        if (!cancelled) setLoading(false)
      }
    })()
    return () => {
      cancelled = true
    }
  }, [sessionId, t])

  const showLink = Boolean(data?.downloadUrl && data?.token)

  return (
    <MerchPageChrome>
      <main className="min-h-screen bg-gradient-to-b from-white to-zinc-50 pt-8">
        <div className="max-w-2xl mx-auto px-4 py-16">
          <h1 className="text-3xl font-bold text-gray-900 mb-4">{t('heading')}</h1>
          {loading ? <p className="text-gray-600">{t('loading')}</p> : null}
          {!sessionId ? <p className="text-gray-600">{t('missingSession')}</p> : null}
          {data?.error ? (
            <p className="text-red-700" role="alert">
              {data.error}
            </p>
          ) : null}
          {data?.unavailable === 'expired' ? (
            <p className="mt-4 text-gray-700" role="status">
              {t('expiredSupport')}
            </p>
          ) : null}
          {data?.unavailable === 'limit' ? (
            <p className="mt-4 text-gray-700" role="status">
              {t('limitSupport')}
            </p>
          ) : null}
          {showLink ? (
            <div className="mt-6 space-y-4 rounded-xl border border-gray-200 bg-white p-6">
              <p className="text-gray-700">{t('saveLink')}</p>
              <a href={data!.downloadUrl!} className="break-all text-[#ba3d3d] font-medium underline">
                {data!.downloadUrl}
              </a>
              {data?.expiresAt ? (
                <p className="text-sm text-gray-500">{t('expires', { date: new Date(data.expiresAt).toLocaleString() })}</p>
              ) : null}
              {data?.emailSent ? <p className="text-sm text-gray-600">{t('emailAlso')}</p> : null}
              {data?.emailPending ? <p className="text-sm text-gray-600">{t('emailRetry')}</p> : null}
              {data?.mock ? <p className="text-sm text-amber-800">{t('mock')}</p> : null}
            </div>
          ) : null}
          <p className="mt-8 text-sm text-gray-600">
            <Link href={publicHref(`/merch/${MERCH_FONT_BUNDLE_SLUG}`, locale)} className="text-[#ba3d3d] hover:underline">
              {t('back')}
            </Link>
          </p>
        </div>
      </main>
    </MerchPageChrome>
  )
}
