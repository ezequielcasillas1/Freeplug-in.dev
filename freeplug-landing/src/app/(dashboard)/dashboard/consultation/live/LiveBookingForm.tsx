'use client'

import { useActionState, useEffect, useState } from 'react'
import * as copy from '@/lib/consultation/copy'
import { calcomEmbedUrl, parseCalcomMessage } from '@/lib/consultation/scheduler'
import { bookLiveSession, type ConsultActionState } from '../actions'

type Method = keyof typeof copy.LIVE_METHOD_LABELS
const METHODS = Object.keys(copy.LIVE_METHOD_LABELS) as Method[]

const input = 'w-full rounded-md border border-zinc-300 px-3 py-2 text-sm bg-white'

export function LiveBookingForm({
  calLink,
  initial,
}: {
  calLink: string | null
  initial: { live_method: Method | null; contact_number: string; email: string; consultationRef: string }
}) {
  const [state, action, pending] = useActionState(bookLiveSession, {} as ConsultActionState)
  const [method, setMethod] = useState<Method | null>(initial.live_method)
  const [bookedAt, setBookedAt] = useState('')
  const [bookingRef, setBookingRef] = useState('')

  // Cal.com embed tells us when a booking succeeds; we store its uid and start time.
  useEffect(() => {
    if (!calLink) return
    const onMessage = (e: MessageEvent) => {
      const parsed = parseCalcomMessage(e.origin, e.data)
      if (!parsed) return
      if (parsed.uid) setBookingRef(`cal.com:${parsed.uid}`)
      if (parsed.startTime) setBookedAt(parsed.startTime)
    }
    window.addEventListener('message', onMessage)
    return () => window.removeEventListener('message', onMessage)
  }, [calLink])

  const needsNumber = method != null && method !== 'webcam'
  const needsConsent = method === 'phone' || method === 'text'
  // Test-mode picker: no earlier than the next hour (computed once, client side).
  const [minLocal] = useState(() => {
    const d = new Date()
    return new Date(d.getTime() + 60 * 60 * 1000 - d.getTimezoneOffset() * 60000).toISOString().slice(0, 16)
  })

  return (
    <form action={action} className="space-y-8" data-testid="live-booking-form">
      <fieldset className="space-y-2">
        <legend className="text-sm font-medium text-gray-900 mb-2">How do you want to talk? *</legend>
        {METHODS.map((m) => (
          <label key={m} className="flex items-start gap-3 rounded-lg border border-zinc-200 bg-white p-3 text-sm min-h-[44px] has-[:checked]:border-[#ba3d3d]">
            <input type="radio" name="live_method" value={m} defaultChecked={initial.live_method === m} onChange={() => setMethod(m)} className="mt-1" />
            <span>
              <span className="font-medium text-gray-900">{copy.LIVE_METHOD_LABELS[m]}</span>
              <span className="block text-gray-600">{copy.LIVE_METHOD_HINTS[m]}</span>
            </span>
          </label>
        ))}
      </fieldset>

      {needsNumber ? (
        <label className="block">
          <span className="text-sm font-medium text-gray-900 mb-2 block">
            {method === 'facetime' ? copy.FACETIME_CONTACT_LABEL : copy.CONTACT_NUMBER_LABEL} *
          </span>
          <input name="contact_number" type={method === 'facetime' ? 'text' : 'tel'} autoComplete="tel" defaultValue={initial.contact_number} className={input + ' max-w-xs'} />
        </label>
      ) : null}

      {needsConsent ? (
        <label className="flex items-start gap-3 text-sm text-gray-700">
          <input type="checkbox" name="consent" className="mt-1" data-testid="consent" />
          <span>{method === 'text' ? copy.TEXT_CONSENT_TEXT : copy.PHONE_CONSENT_TEXT}</span>
        </label>
      ) : null}

      {method ? (
        <section className="space-y-3">
          <h2 className="text-lg font-semibold text-gray-900">{copy.SCHEDULER_HEADING}</h2>
          {calLink ? (
            <>
              <iframe
                title="Book a time"
                src={calcomEmbedUrl(calLink, { email: initial.email, method, ref: initial.consultationRef })}
                className="h-[640px] w-full rounded-lg border border-zinc-200 bg-white"
              />
              <label className="block text-sm">
                <span className="text-gray-700">Booked already? Paste your booking confirmation link or time if it did not fill in automatically.</span>
                <input name="booking_ref" value={bookingRef} onChange={(e) => setBookingRef(e.target.value)} className={input + ' mt-1'} />
              </label>
              <input type="hidden" name="booked_at" value={bookedAt} />
            </>
          ) : (
            <>
              <p className="rounded-md bg-amber-50 px-3 py-2 text-xs text-amber-900" data-testid="scheduler-test-mode">{copy.SCHEDULER_TEST_MODE_NOTE}</p>
              <input
                type="datetime-local"
                min={minLocal}
                value={bookedAt}
                onChange={(e) => setBookedAt(e.target.value)}
                className={input + ' max-w-xs'}
                aria-label="Session time"
              />
              <input type="hidden" name="booked_at" value={bookedAt ? new Date(bookedAt).toISOString() : ''} />
              <input type="hidden" name="booking_ref" value={bookedAt ? 'test-mode' : ''} />
            </>
          )}
        </section>
      ) : null}

      {state.error ? <p className="text-sm text-red-600" role="alert">{state.error}</p> : null}
      <button
        type="submit"
        disabled={pending || !method}
        className="min-h-[44px] rounded-md bg-[#ba3d3d] px-5 text-sm font-semibold text-white hover:bg-[#9a3232] disabled:opacity-50"
      >
        {copy.BOOKING_CONFIRM_LABEL}
      </button>
    </form>
  )
}
