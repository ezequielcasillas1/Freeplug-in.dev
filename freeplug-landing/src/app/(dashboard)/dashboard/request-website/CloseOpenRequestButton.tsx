'use client'

import { useRouter } from 'next/navigation'
import { useState, useTransition } from 'react'
import { useTranslations } from 'next-intl'
import { Button } from '@/components/ui/button'
import { cancelOwnWebsiteRequest } from './actions'
import type { SelfClosableStatus } from '@/lib/consultation/status'

type Props = {
  /** Any self-closable status (submitted, in_review, consultation, agreed). Never building. */
  status: SelfClosableStatus
  className?: string
}

export function CloseOpenRequestButton({ status, className }: Props) {
  const router = useRouter()
  const t = useTranslations('dashboard.request')
  const [pending, startTransition] = useTransition()
  const [error, setError] = useState<string | null>(null)

  const tc = useTranslations('consultation')
  const reviewing = status === 'in_review'
  const consulting = status === 'consultation' || status === 'agreed'

  return (
    <div className={className}>
      <p className="text-sm text-gray-600 mb-2">
        {consulting
          ? tc('closeRequestIntro')
          : reviewing
          ? t('CloseOpenRequestButton.noLongerWantUs')
          : t('CloseOpenRequestButton.closeRequestBeforeFinish')}
      </p>
      <Button
        type="button"
        variant="secondary"
        size="sm"
        className="border border-zinc-300 bg-white text-gray-800 hover:bg-zinc-50"
        disabled={pending}
        data-testid="close-request-button"
        onClick={() => {
          if (!window.confirm(t('closeConfirm'))) return
          setError(null)
          startTransition(async () => {
            const r = await cancelOwnWebsiteRequest()
            if (r.ok) {
              router.refresh()
            } else {
              setError(r.error)
            }
          })
        }}
      >
        {pending ? t('CloseOpenRequestButton.closing') : t('CloseOpenRequestButton.closeRequest')}
      </Button>
      {error ? (
        <p className="mt-2 text-xs text-red-600" role="alert">
          {error}
        </p>
      ) : null}
    </div>
  )
}
