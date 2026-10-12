'use client'

import { useRouter } from 'next/navigation'
import { useState, useTransition } from 'react'
import { useTranslations } from 'next-intl'
import { Button } from '@/components/ui/button'
import { cancelOwnWebsiteRequest } from './actions'

type Props = {
  /** submitted: full withdraw; in_review: still allowed to close from customer side */
  status: 'submitted' | 'in_review'
  className?: string
}

export function CloseOpenRequestButton({ status, className }: Props) {
  const router = useRouter()
  const t = useTranslations('dashboard.request')
  const [pending, startTransition] = useTransition()
  const [error, setError] = useState<string | null>(null)

  const reviewing = status === 'in_review'

  return (
    <div className={className}>
      <p className="text-sm text-gray-600 mb-2">
        {reviewing
          ? t('CloseOpenRequestButton.noLongerWantUs')
          : t('CloseOpenRequestButton.closeRequestBeforeFinish')}
      </p>
      <Button
        type="button"
        variant="secondary"
        size="sm"
        className="border border-zinc-300 bg-white text-gray-800 hover:bg-zinc-50"
        disabled={pending}
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
