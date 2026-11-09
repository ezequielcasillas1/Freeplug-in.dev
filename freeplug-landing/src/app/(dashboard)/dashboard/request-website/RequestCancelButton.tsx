'use client'

import { useState, useTransition } from 'react'
import { useTranslations } from 'next-intl'
import { Button } from '@/components/ui/button'
import { requestCancelDuringBuild } from './actions'

/** Shown at building instead of Close (Aria, Oct 22 8:37 PM CT). Alerts the team; status unchanged. */
export function RequestCancelButton({ className }: { className?: string }) {
  const t = useTranslations('consultation')
  const [pending, startTransition] = useTransition()
  const [error, setError] = useState<string | null>(null)
  const [sent, setSent] = useState(false)

  return (
    <div className={className}>
      <p className="text-sm text-gray-600 mb-2">{t('requestCancelIntro')}</p>
      {sent ? (
        <p className="text-sm text-gray-800" role="status" data-testid="request-cancel-sent">
          {t('requestCancelSent')}
        </p>
      ) : (
        <Button
          type="button"
          variant="secondary"
          size="sm"
          className="border border-zinc-300 bg-white text-gray-800 hover:bg-zinc-50"
          disabled={pending}
          data-testid="request-cancel-button"
          onClick={() => {
            if (!window.confirm(t('requestCancelConfirm'))) return
            setError(null)
            startTransition(async () => {
              const r = await requestCancelDuringBuild()
              if (r.ok) setSent(true)
              else setError(r.error)
            })
          }}
        >
          {t('requestCancelButton')}
        </Button>
      )}
      {error ? (
        <p className="mt-2 text-xs text-red-600" role="alert">
          {error}
        </p>
      ) : null}
    </div>
  )
}
