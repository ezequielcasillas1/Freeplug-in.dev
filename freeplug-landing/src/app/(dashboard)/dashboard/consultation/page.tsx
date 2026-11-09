import type { Metadata } from 'next'
import Link from 'next/link'
import { redirect } from 'next/navigation'
import { consultationCopy } from '@/lib/consultation/i18n'
import { currentLocale } from '@/i18n/current-locale'
import { consultationStage } from '@/lib/consultation/status'
import { ConsultationChooser } from './ConsultationChooser'
import { loadOwnConsultation } from './load'

export const metadata: Metadata = { title: 'Your consultation | Freeplug' }

/** "Next: your consultation": pick path A (details form) or path B (live session). */
export default async function ConsultationPage({ searchParams }: { searchParams: Promise<{ switch?: string }> }) {
  const copy = consultationCopy(await currentLocale())
  const q = await searchParams
  const own = await loadOwnConsultation()
  if (!own) redirect('/login')
  if (!own.request) {
    return (
      <div className="max-w-2xl">
        <h1 className="text-3xl font-bold text-gray-900 mb-2">{copy.CONSULT_CARD_HEADING}</h1>
        <p className="text-gray-600 mb-6">{copy.NO_OPEN_REQUEST}</p>
        <Link href="/dashboard/request-website" className="font-semibold text-[#ba3d3d] hover:underline">
          Request a website →
        </Link>
      </div>
    )
  }
  const stage = consultationStage(own.consultation)
  if (q.switch !== '1') {
    if (stage === 'form_draft') redirect('/dashboard/consultation/details')
    if (stage === 'live_booking' || stage === 'live_waiting') redirect('/dashboard/consultation/live')
    if (stage === 'review' || stage === 'agreed') redirect('/dashboard/consultation/summary')
  }
  return <ConsultationChooser businessName={own.request.business_name} />
}
