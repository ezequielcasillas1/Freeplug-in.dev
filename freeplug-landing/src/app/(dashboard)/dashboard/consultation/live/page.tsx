import type { Metadata } from 'next'
import Link from 'next/link'
import { redirect } from 'next/navigation'
import { consultationCopy } from '@/lib/consultation/i18n'
import { currentLocale } from '@/i18n/current-locale'
import { calcomLink } from '@/lib/consultation/scheduler'
import { loadOwnConsultation } from '../load'
import { LiveBookingForm } from './LiveBookingForm'

export const metadata: Metadata = { title: 'Book a live session | Freeplug' }

export default async function ConsultationLivePage({ searchParams }: { searchParams: Promise<{ new?: string; edit?: string; booked?: string }> }) {
  const copy = consultationCopy(await currentLocale())
  const q = await searchParams
  const own = await loadOwnConsultation()
  if (!own) redirect('/login')
  if (!own.request) redirect('/dashboard/consultation')
  const c = own.consultation
  if (c?.agreed_at || c?.ready_for_review_at) redirect('/dashboard/consultation/summary')

  const booked = c?.path === 'live' && (c.booked_at || c.booking_ref)
  if (booked && q.edit !== '1') {
    const method = copy.LIVE_METHOD_LABELS[c.live_method ?? 'phone']
    const when = c.booked_at
      ? new Date(c.booked_at).toLocaleString('en-US', { dateStyle: 'full', timeStyle: 'short', timeZone: 'America/Chicago' }) + ' CT'
      : null
    return (
      <div className="max-w-2xl">
        {q.booked ? <p className="mb-4 rounded-md bg-green-50 px-4 py-3 text-sm text-green-800" role="status">Booked. Thanks!</p> : null}
        <h1 className="text-3xl font-bold text-gray-900 mb-2">{copy.LIVE_BOOKED_HEADING}</h1>
        <p className="text-gray-600 mb-4" data-testid="live-booked">{copy.liveBookedBody(when, method)}</p>
        {c.booking_ref ? <p className="text-sm text-gray-500 mb-4">Booking: {c.booking_ref}</p> : null}
        <div className="flex flex-col gap-2 text-sm">
          <Link href="/dashboard/consultation/live?edit=1" className="text-[#ba3d3d] hover:underline">{copy.RESCHEDULE_LABEL}</Link>
          <Link href="/dashboard/consultation?switch=1" className="text-[#ba3d3d] hover:underline">{copy.SWITCH_TO_FORM}</Link>
          <Link href="/dashboard" className="text-gray-500 hover:underline">← Back to dashboard</Link>
        </div>
      </div>
    )
  }

  return (
    <div className="max-w-2xl">
      <h1 className="text-3xl font-bold text-gray-900 mb-2">{copy.LIVE_PAGE_HEADING}</h1>
      <p className="text-gray-600 mb-8">{copy.LIVE_PAGE_INTRO}</p>
      <LiveBookingForm
        calLink={calcomLink()}
        initial={{
          live_method: c?.path === 'live' ? c.live_method : null,
          contact_number: c?.contact_number ?? '',
          email: own.email ?? '',
          consultationRef: own.request.id,
        }}
      />
      <p className="mt-8 text-sm">
        <Link href="/dashboard/consultation?switch=1" className="text-[#ba3d3d] hover:underline">{copy.SWITCH_TO_FORM}</Link>
      </p>
    </div>
  )
}
