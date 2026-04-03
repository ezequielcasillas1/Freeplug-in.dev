'use client'

import { useRouter } from 'next/navigation'
import { useState, useTransition } from 'react'
import { Button } from '@/components/ui/button'
import { acknowledgeWebsiteTransfer } from './transfer-actions'

export function AcknowledgeTransferButton() {
  const router = useRouter()
  const [pending, startTransition] = useTransition()
  const [error, setError] = useState<string | null>(null)

  return (
    <div className="mt-3">
      <Button
        type="button"
        size="sm"
        variant="secondary"
        disabled={pending}
        onClick={() => {
          setError(null)
          startTransition(async () => {
            const r = await acknowledgeWebsiteTransfer()
            if (r.ok) {
              router.refresh()
            } else {
              setError(r.error)
            }
          })
        }}
      >
        {pending ? 'Saving…' : "I've reviewed this handoff"}
      </Button>
      {error ? <p className="mt-2 text-xs text-red-600">{error}</p> : null}
    </div>
  )
}
