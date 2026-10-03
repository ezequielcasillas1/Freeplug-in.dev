'use client'

import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { CHANGE_REQUEST_COPY } from '@/lib/help/help-chat-content'
import { DOMAIN_REQUEST_SENT, HAVE_DOMAIN_LABEL, NEED_DOMAIN_HELPER, NEED_DOMAIN_LABEL } from '@/lib/outreach/copy'
import { requestDomainSetup } from './actions'

const INPUT =
  'w-full rounded-lg border border-zinc-300 px-3 py-2 text-gray-900 focus:ring-2 focus:ring-[#ba3d3d] outline-none'

export function DomainRequestForm() {
  const [kind, setKind] = useState<'have_domain' | 'need_domain'>('have_domain')
  const [domain, setDomain] = useState('')
  const [pending, setPending] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [done, setDone] = useState(false)
  if (done) return <p className="text-sm font-medium text-gray-800" role="status">{DOMAIN_REQUEST_SENT}</p>
  return (
    <form
      className="space-y-4"
      onSubmit={async (e) => {
        e.preventDefault()
        setPending(true)
        setError(null)
        const res = await requestDomainSetup(kind === 'have_domain' ? { kind, domain } : { kind })
        setPending(false)
        if (res.ok) setDone(true)
        else setError(res.error)
      }}
    >
      <fieldset className="space-y-2">
        {(['have_domain', 'need_domain'] as const).map((k) => (
          <label
            key={k}
            className={`flex cursor-pointer items-start gap-3 rounded-lg border p-3 ${kind === k ? 'border-[#ba3d3d]' : 'border-gray-200'}`}
          >
            <input type="radio" name="kind" value={k} checked={kind === k} onChange={() => setKind(k)} className="mt-1 text-[#ba3d3d] focus:ring-[#ba3d3d]" />
            <span className="text-sm text-gray-700">
              <span className="font-medium text-gray-900">{k === 'have_domain' ? HAVE_DOMAIN_LABEL : NEED_DOMAIN_LABEL}</span>
              {k === 'need_domain' ? <span className="block text-gray-500">{NEED_DOMAIN_HELPER}</span> : null}
            </span>
          </label>
        ))}
      </fieldset>
      {kind === 'have_domain' ? (
        <div>
          <label htmlFor="domain" className="sr-only">
            {HAVE_DOMAIN_LABEL}
          </label>
          <input id="domain" className={INPUT} placeholder="yourbusiness.com" value={domain} onChange={(e) => setDomain(e.target.value)} required maxLength={253} />
        </div>
      ) : null}
      <Button type="submit" disabled={pending} className="w-full sm:w-auto">
        {pending ? '…' : CHANGE_REQUEST_COPY.send}
      </Button>
      {error ? (
        <p className="text-sm text-red-700" role="alert">
          {error}
        </p>
      ) : null}
    </form>
  )
}
