'use client'

import { useState, useTransition } from 'react'
import { Button } from '@/components/ui/button'
import { BUYOUT_REQUEST_LABEL, BUYOUT_THANKS, type BuyoutRequestResult } from '@/lib/buyout/buyout'

type Props = {
  alreadyRequested: boolean
  /** Server action; injectable so the preview harness and tests don't write anything. */
  onRequest: () => Promise<BuyoutRequestResult>
}

/**
 * Outline button (never the primary style: Resume plan / Restart hosting stay the main action).
 * After the request is sent, the thank-you line takes the button's place in the same card.
 */
export function BuyoutRequestButton({ alreadyRequested, onRequest }: Props) {
  const [done, setDone] = useState(alreadyRequested)
  const [error, setError] = useState<string | null>(null)
  const [pending, startTransition] = useTransition()

  if (done) {
    return (
      <p className="text-sm font-medium text-gray-800" role="status" data-testid="buyout-thanks">
        {BUYOUT_THANKS}
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
            const res = await onRequest()
            if (res.ok) setDone(true)
            else setError(res.error)
          })
        }}
      >
        {BUYOUT_REQUEST_LABEL}
      </Button>
      {error ? (
        <p className="mt-2 text-sm text-red-700" role="alert">
          {error}
        </p>
      ) : null}
    </div>
  )
}
