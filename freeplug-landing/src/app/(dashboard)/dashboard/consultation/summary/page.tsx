import type { Metadata } from 'next'
import Link from 'next/link'
import { redirect } from 'next/navigation'
import { ChecklistSummary } from '@/components/consultation/ChecklistSummary'
import { consultationCopy } from '@/lib/consultation/i18n'
import { currentLocale } from '@/i18n/current-locale'
import { loadOwnConsultation } from '../load'
import { SummaryActions } from './SummaryActions'

export const metadata: Metadata = { title: 'Review your summary | Freeplug' }

export default async function ConsultationSummaryPage() {
  const copy = consultationCopy(await currentLocale())
  const own = await loadOwnConsultation()
  if (!own) redirect('/login')
  const c = own.consultation
  if (!own.request || !c) redirect('/dashboard/consultation')
  if (!c.agreed_at && !c.ready_for_review_at) redirect('/dashboard/consultation')

  if (c.agreed_at) {
    return (
      <div className="max-w-2xl">
        <h1 className="text-3xl font-bold text-gray-900 mb-2">{copy.AGREED_HEADING}</h1>
        <p className="text-gray-600 mb-2">{copy.AGREED_BODY}</p>
        <p className="text-sm text-gray-500 mb-6" data-testid="agreed-at">
          Agreed {new Date(c.agreed_at).toLocaleString('en-US', { dateStyle: 'medium', timeStyle: 'short', timeZone: 'America/Chicago' })} CT
        </p>
        <ChecklistSummary checklist={own.checklist} />
        <p className="mt-6 text-sm text-gray-500">{copy.LOCKED_AFTER_AGREED}</p>
        <p className="mt-4 text-sm"><Link href="/dashboard" className="text-[#ba3d3d] hover:underline">{copy.BACK_TO_DASHBOARD}</Link></p>
      </div>
    )
  }

  return (
    <div className="max-w-2xl">
      <h1 className="text-3xl font-bold text-gray-900 mb-2">{copy.REVIEW_HEADING}</h1>
      <p className="text-gray-600 mb-6">{c.prepared_by === 'team' ? copy.REVIEW_INTRO_TEAM : copy.REVIEW_INTRO_CLIENT}</p>
      <ChecklistSummary checklist={own.checklist} />
      <p className="mt-6 text-sm text-gray-600">{copy.LOOKS_GOOD_NOTE}</p>
      <SummaryActions />
    </div>
  )
}
