'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { cleanupPhotosAction, markDomainDoneAction } from './actions'

export function MarkDomainDoneButton({ id }: { id: string }) {
  const router = useRouter()
  const [busy, setBusy] = useState(false)
  return (
    <button
      type="button"
      disabled={busy}
      className="text-sm font-semibold text-[#ba3d3d] hover:underline disabled:opacity-50"
      onClick={async () => {
        setBusy(true)
        await markDomainDoneAction(id)
        setBusy(false)
        router.refresh()
      }}
    >
      Mark done
    </button>
  )
}

/** Admin-triggered 90-day cleanup of photos from unclaimed previews (ready for a scheduler). */
export function CleanupPhotosButton() {
  const [msg, setMsg] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  return (
    <div className="flex flex-wrap items-center gap-3">
      <button
        type="button"
        disabled={busy}
        className="text-sm text-gray-600 hover:text-gray-900 hover:underline disabled:opacity-50"
        onClick={async () => {
          setBusy(true)
          const res = await cleanupPhotosAction()
          setBusy(false)
          setMsg(res.ok ? `Deleted ${res.deleted} old photo${res.deleted === 1 ? '' : 's'}.` : res.error)
        }}
      >
        Delete photos from unclaimed previews older than 90 days
      </button>
      {msg ? <span className="text-sm text-gray-700">{msg}</span> : null}
    </div>
  )
}
