'use client'

import { useState, useTransition } from 'react'
import { Button } from '@/components/ui/button'
import { useTranslations } from 'next-intl'
import type { BuyoutRequestResult } from '@/lib/buyout/buyout'
import type { BuyoutTierId } from '@/lib/buyout/tiers'

type Props = {
  alreadyRequested: boolean
  /** Server action; injectable so the preview harness and tests don't write anything. */
  onRequest: (tierId?: BuyoutTierId) => Promise<BuyoutRequestResult>
  /** The tier picked above the button (Oct 19); passed to onRequest. */
  tierId?: BuyoutTierId
}

/**
 * Outline button (never the primary style: Resume plan / Restart hosting stay the main action).
 * After the request is sent, the thank-you line takes the button's place in the same card.
 */
export function BuyoutRequestButton({ alreadyRequested, onRequest, tierId }: Props) {
  const t = useTranslations('buyout')
  const [done, setDone] = useState(alreadyRequested)
  const [error, setError] = useState<string | null>(null)
  const [pending, startTransition] = useTransition()

  if (done) {
    return (
      <p className="text-sm font-medium text-gray-800" role="status" data-testid="buyout-thanks">
        {t('thanks')}
      </p>
    )
  }

  return (
    <div>
      <Button
        type="button"
        variant="secondary"
        size="sm"
        className="whitespace-nowrap"
        disabled={pending}
        aria-disabled={pending}
        onClick={() => {
          if (pending) return
          setError(null)
          startTransition(async () => {
            const res = await (tierId ? onRequest(tierId) : onRequest())
            if (res.ok) setDone(true)
            else setError(res.error)
          })
        }}
      >
        {t('requestLabel')}
      </Button>
      {error ? (
        <p className="mt-2 text-sm text-red-700" role="alert">
          {error}
        </p>
      ) : null}
    </div>
  )
}
