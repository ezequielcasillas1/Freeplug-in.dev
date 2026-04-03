'use client'

import { useActionState, useEffect, useRef } from 'react'
import { Button } from '@/components/ui/button'
import { submitWebsiteRequest, type RequestWebsiteState } from './actions'

type Props = {
  focusMaintenance?: boolean
}

export function RequestWebsiteForm({ focusMaintenance = false }: Props) {
  const [state, formAction, pending] = useActionState(
    submitWebsiteRequest,
    {} as RequestWebsiteState
  )
  const notesRef = useRef<HTMLTextAreaElement>(null)

  useEffect(() => {
    if (!focusMaintenance || !notesRef.current) return
    notesRef.current.scrollIntoView({ behavior: 'smooth', block: 'center' })
    notesRef.current.focus()
  }, [focusMaintenance])

  const notesLabel = focusMaintenance
    ? 'Describe the maintenance or changes needed *'
    : 'Tell us about your business'

  const notesHint = focusMaintenance
    ? 'Include what should change (e.g. hours, photos, a section overhaul). We will review and quote before charging.'
    : null

  return (
    <form action={formAction} className="space-y-4 max-w-lg">
      {state?.error ? (
        <p className="text-sm text-red-600" role="alert">
          {state.error}
        </p>
      ) : null}

      {focusMaintenance ? (
        <p className="rounded-lg bg-zinc-50 border border-zinc-200 text-gray-800 px-4 py-3 text-sm">
          Maintenance pricing follows a quick review — typically around $20 for a small change up
          to about $50 for a larger overhaul. We confirm the price before you pay.
        </p>
      ) : null}

      <div>
        <label htmlFor="business_name" className="block text-sm font-medium text-gray-700 mb-1">
          Business name *
        </label>
        <input
          id="business_name"
          name="business_name"
          required
          maxLength={200}
          className="w-full rounded-lg border border-zinc-300 px-3 py-2 text-gray-900 focus:ring-2 focus:ring-[#ba3d3d] outline-none"
        />
      </div>

      <div>
        <label htmlFor="contact_phone" className="block text-sm font-medium text-gray-700 mb-1">
          Phone
        </label>
        <input
          id="contact_phone"
          name="contact_phone"
          type="tel"
          maxLength={50}
          className="w-full rounded-lg border border-zinc-300 px-3 py-2 text-gray-900 focus:ring-2 focus:ring-[#ba3d3d] outline-none"
        />
      </div>

      <div>
        <label
          htmlFor="google_business_url"
          className="block text-sm font-medium text-gray-700 mb-1"
        >
          Google Business Profile URL
        </label>
        <input
          id="google_business_url"
          name="google_business_url"
          type="url"
          placeholder="https://g.page/..."
          maxLength={2000}
          className="w-full rounded-lg border border-zinc-300 px-3 py-2 text-gray-900 focus:ring-2 focus:ring-[#ba3d3d] outline-none"
        />
      </div>

      <div id="notes">
        <label htmlFor="notes" className="block text-sm font-medium text-gray-700 mb-1">
          {notesLabel}
        </label>
        {notesHint ? <p className="text-xs text-gray-500 mb-2">{notesHint}</p> : null}
        <textarea
          ref={notesRef}
          id="notes"
          name="notes"
          rows={5}
          maxLength={5000}
          required={focusMaintenance}
          className="w-full rounded-lg border border-zinc-300 px-3 py-2 text-gray-900 focus:ring-2 focus:ring-[#ba3d3d] outline-none resize-y"
        />
      </div>

      <Button type="submit" className="w-full sm:w-auto" disabled={pending}>
        {pending ? 'Sending…' : 'Submit request'}
      </Button>
    </form>
  )
}
