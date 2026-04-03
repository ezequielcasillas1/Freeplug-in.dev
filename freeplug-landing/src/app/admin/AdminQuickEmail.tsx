'use client'

import { useState, useTransition } from 'react'
import { adminSendCustomerEmail } from './actions'

type Props = {
  to: string | null
  smtpConfigured: boolean
}

export function AdminQuickEmail({ to, smtpConfigured }: Props) {
  const [open, setOpen] = useState(false)
  const [subject, setSubject] = useState('')
  const [body, setBody] = useState('')
  const [msg, setMsg] = useState<{ type: 'ok' | 'err'; text: string } | null>(null)
  const [pending, startTransition] = useTransition()

  if (!to) {
    return <span className="text-zinc-400">—</span>
  }

  return (
    <div className="max-w-[260px]">
      <a
        href={`mailto:${encodeURIComponent(to)}`}
        className="text-[#ba3d3d] hover:underline break-all text-sm block"
      >
        {to}
      </a>
      {smtpConfigured ? (
        <div className="mt-2">
          <button
            type="button"
            onClick={() => {
              setOpen((o) => !o)
              setMsg(null)
            }}
            className="text-xs font-medium text-zinc-600 hover:text-[#ba3d3d]"
          >
            {open ? 'Hide SMTP send' : 'Send via SMTP'}
          </button>
          {open ? (
            <form
              className="mt-2 space-y-2 border border-zinc-200 rounded-md p-2 bg-zinc-50"
              onSubmit={(e) => {
                e.preventDefault()
                setMsg(null)
                startTransition(async () => {
                  const r = await adminSendCustomerEmail(to, subject, body)
                  if (r.ok) {
                    setMsg({ type: 'ok', text: 'Sent.' })
                    setSubject('')
                    setBody('')
                  } else {
                    setMsg({ type: 'err', text: r.error })
                  }
                })
              }}
            >
              <input
                className="w-full border border-zinc-300 rounded px-2 py-1 text-xs"
                placeholder="Subject"
                value={subject}
                onChange={(e) => setSubject(e.target.value)}
                disabled={pending}
                required
              />
              <textarea
                className="w-full border border-zinc-300 rounded px-2 py-1 text-xs min-h-[72px]"
                placeholder="Message (plain text)"
                value={body}
                onChange={(e) => setBody(e.target.value)}
                disabled={pending}
                required
              />
              <button
                type="submit"
                disabled={pending}
                className="text-xs font-semibold bg-[#ba3d3d] text-white px-2 py-1 rounded disabled:opacity-50"
              >
                {pending ? 'Sending…' : 'Send'}
              </button>
              {msg ? (
                <p
                  className={
                    msg.type === 'ok' ? 'text-xs text-emerald-700' : 'text-xs text-red-600'
                  }
                >
                  {msg.text}
                </p>
              ) : null}
            </form>
          ) : null}
        </div>
      ) : (
        <p className="text-[10px] text-zinc-400 mt-1">SMTP not set — use mailto</p>
      )}
    </div>
  )
}
