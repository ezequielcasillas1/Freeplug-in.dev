import type { Metadata } from 'next'
import Link from 'next/link'
import { redirect } from 'next/navigation'
import { consultationCopy } from '@/lib/consultation/i18n'
import { currentLocale } from '@/i18n/current-locale'
import { loadOwnConsultation } from '../load'
import { ConsultationForm } from './ConsultationForm'

export const metadata: Metadata = { title: 'Website details | Freeplug' }

export default async function ConsultationDetailsPage() {
  const copy = consultationCopy(await currentLocale())
  const own = await loadOwnConsultation()
  if (!own) redirect('/login')
  if (!own.request || !own.consultation) redirect('/dashboard/consultation')
  const c = own.consultation
  if (c.agreed_at) redirect('/dashboard/consultation/summary')
  // A live session's summary is written by the team first; until then, the booking page.
  if (c.path === 'live' && c.prepared_by !== 'team') redirect('/dashboard/consultation/live')
  if (c.ready_for_review_at) redirect('/dashboard/consultation/summary')
  return (
    <div className="max-w-2xl">
      <h1 className="text-3xl font-bold text-gray-900 mb-2">{copy.FORM_PAGE_HEADING}</h1>
      <p className="text-gray-600 mb-8">{copy.FORM_PAGE_INTRO}</p>
      <ConsultationForm initial={own.checklist} />
      {c.path === 'form' ? (
        <p className="mt-8 text-sm">
          <Link href="/dashboard/consultation/live?new=1" className="text-[#ba3d3d] hover:underline">{copy.SWITCH_TO_LIVE}</Link>
        </p>
      ) : null}
      <p className="mt-4 text-sm text-gray-500">
        <Link href="/dashboard" className="text-[#ba3d3d] hover:underline">{copy.BACK_TO_DASHBOARD}</Link>
      </p>
    </div>
  )
}
