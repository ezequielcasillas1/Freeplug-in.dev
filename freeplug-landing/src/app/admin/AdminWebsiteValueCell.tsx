'use client'

import { useRouter } from 'next/navigation'
import { useState, useTransition } from 'react'
import { adminSetProfileWebsiteValueTarget } from './actions'

type Props = {
  profileId: string
  targetCents: number | null
}

export function AdminWebsiteValueCell({ profileId, targetCents }: Props) {
  const router = useRouter()
  const [pending, startTransition] = useTransition()
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null)
  const [dollars, setDollars] = useState(
    targetCents != null ? String(Math.round(targetCents / 100)) : ''
  )

  return (
    <div className="min-w-[140px] space-y-1">
      <p className="text-xs text-zinc-500">
        Current:{' '}
        {targetCents != null ? (
          <span className="font-medium text-zinc-800">
            ${(targetCents / 100).toFixed(0)}
          </span>
        ) : (
          '—'
        )}
      </p>
      <div className="flex flex-col gap-1">
        <input
          type="number"
          min={0}
          max={500_000}
          step={1}
          value={dollars}
          onChange={(e) => setDollars(e.target.value)}
          disabled={pending}
          placeholder="USD"
          className="w-full border border-zinc-300 rounded px-2 py-1 text-xs"
          aria-label="Website value target in US dollars"
        />
        <div className="flex flex-wrap gap-1">
          <button
            type="button"
            disabled={pending}
            onClick={() => {
              setMsg(null)
              startTransition(async () => {
                const r = await adminSetProfileWebsiteValueTarget(profileId, dollars)
                if (r.ok) {
                  setMsg({ ok: true, text: 'Saved.' })
                  router.refresh()
                } else {
                  setMsg({ ok: false, text: r.error })
                }
              })
            }}
            className="text-xs font-semibold bg-[#ba3d3d] text-white px-2 py-0.5 rounded disabled:opacity-50"
          >
            Save
          </button>
          <button
            type="button"
            disabled={pending}
            onClick={() => {
              setMsg(null)
              setDollars('')
              startTransition(async () => {
                const r = await adminSetProfileWebsiteValueTarget(profileId, '')
                if (r.ok) {
                  setMsg({ ok: true, text: 'Cleared.' })
                  router.refresh()
                } else {
                  setMsg({ ok: false, text: r.error })
                }
              })
            }}
            className="text-xs text-zinc-600 hover:text-[#ba3d3d] px-1"
          >
            Clear
          </button>
        </div>
      </div>
      {msg ? (
        <p className={msg.ok ? 'text-[10px] text-emerald-700' : 'text-[10px] text-red-600'}>
          {msg.text}
        </p>
      ) : null}
    </div>
  )
}
