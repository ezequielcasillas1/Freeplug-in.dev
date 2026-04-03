'use client'

import { useRouter } from 'next/navigation'
import { useState, useTransition } from 'react'
import { adminSetProfileCumulativeWebsiteValuePaid } from './actions'

type Props = {
  profileId: string
  paidCents: number
}

export function AdminCumulativePaidCell({ profileId, paidCents }: Props) {
  const router = useRouter()
  const [pending, startTransition] = useTransition()
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null)
  const [dollars, setDollars] = useState(String(Math.round(paidCents / 100)))

  return (
    <div className="min-w-[140px] space-y-1">
      <p className="text-xs text-amber-800 font-medium">Override (QA)</p>
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
          aria-label="Cumulative website value paid in US dollars (QA override)"
        />
        <button
          type="button"
          disabled={pending}
          onClick={() => {
            setMsg(null)
            startTransition(async () => {
              const r = await adminSetProfileCumulativeWebsiteValuePaid(profileId, dollars)
              if (r.ok) {
                setMsg({ ok: true, text: 'Saved.' })
                router.refresh()
              } else {
                setMsg({ ok: false, text: r.error })
              }
            })
          }}
          className="text-xs font-semibold bg-[#ba3d3d] text-white px-2 py-0.5 rounded disabled:opacity-50 self-start"
        >
          Save
        </button>
      </div>
      {msg ? (
        <p className={msg.ok ? 'text-[10px] text-emerald-700' : 'text-[10px] text-red-600'}>
          {msg.text}
        </p>
      ) : null}
    </div>
  )
}
