'use client'

import { useRouter } from 'next/navigation'
import { useEffect, useState, useTransition } from 'react'
import { adminSetProfileWebsiteTransferNotes } from './actions'

type Props = {
  profileId: string
  notes: string | null
}

export function AdminTransferNotesCell({ profileId, notes }: Props) {
  const router = useRouter()
  const [pending, startTransition] = useTransition()
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null)
  const [text, setText] = useState(notes ?? '')

  useEffect(() => {
    setText(notes ?? '')
  }, [notes])

  return (
    <div className="min-w-[200px] max-w-[280px] space-y-1">
      <p className="text-[10px] text-zinc-500">
        Shown on customer dashboard only after <strong>website value</strong> is reached. Resets their
        &quot;reviewed&quot; flag when you save.
      </p>
      <textarea
        value={text}
        onChange={(e) => setText(e.target.value)}
        disabled={pending}
        rows={4}
        placeholder="DNS, repo links, export steps, key handoff (plain text)…"
        className="w-full border border-zinc-300 rounded px-2 py-1 text-xs font-mono"
        aria-label="Website transfer handoff notes for customer"
      />
      <div className="flex flex-wrap gap-1">
        <button
          type="button"
          disabled={pending}
          onClick={() => {
            setMsg(null)
            startTransition(async () => {
              const r = await adminSetProfileWebsiteTransferNotes(profileId, text)
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
            setText('')
            startTransition(async () => {
              const r = await adminSetProfileWebsiteTransferNotes(profileId, '')
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
      {msg ? (
        <p className={msg.ok ? 'text-[10px] text-emerald-700' : 'text-[10px] text-red-600'}>
          {msg.text}
        </p>
      ) : null}
    </div>
  )
}
