import Link from 'next/link'
import * as copy from '@/lib/consultation/copy'
import type { ConsultationStage } from '@/lib/consultation/status'

const STAGE_LINE: Record<ConsultationStage, { line: string; href: string; cta: string }> = {
  choose: { line: copy.CONSULT_CARD_BODY, href: '/dashboard/consultation', cta: 'Choose how →' },
  form_draft: { line: 'You started filling in the details. Pick up where you left off.', href: '/dashboard/consultation/details', cta: 'Continue the form →' },
  live_booking: { line: 'Pick how you want to talk and book a time.', href: '/dashboard/consultation/live', cta: 'Book a session →' },
  live_waiting: { line: 'Your live session is booked. We will send a summary to check afterwards.', href: '/dashboard/consultation/live', cta: 'See your booking →' },
  review: { line: 'Your summary is ready. Check it and click Looks good, or change something.', href: '/dashboard/consultation/summary', cta: `${copy.REVIEW_HEADING} →` },
  agreed: { line: copy.AGREED_BODY, href: '/dashboard/consultation/summary', cta: 'View your agreed plan →' },
}

/** Dashboard card: "Next: your consultation" with the two paths, or where the client is now. */
export function NextConsultationCard({ stage }: { stage: ConsultationStage }) {
  const s = STAGE_LINE[stage]
  return (
    <section className="rounded-xl border border-[#ba3d3d]/30 bg-white p-6 shadow-sm" data-testid="next-consultation" data-stage={stage}>
      <h2 className="text-lg font-semibold text-gray-900 mb-1">
        {stage === 'review' ? copy.REVIEW_HEADING : stage === 'agreed' ? copy.AGREED_HEADING : copy.CONSULT_CARD_HEADING}
      </h2>
      <p className="text-sm text-gray-600 mb-4">{s.line}</p>
      {stage === 'choose' ? (
        <div className="grid gap-4 sm:grid-cols-2">
          <Link href="/dashboard/consultation" className="rounded-lg border border-zinc-200 p-4 hover:border-[#ba3d3d]">
            <span className="block font-semibold text-gray-900">{copy.PATH_FORM_TITLE}</span>
            <span className="block text-sm text-gray-600 mt-1">{copy.PATH_FORM_BODY}</span>
          </Link>
          <Link href="/dashboard/consultation/live?new=1" className="rounded-lg border border-zinc-200 p-4 hover:border-[#ba3d3d]">
            <span className="block font-semibold text-gray-900">{copy.PATH_LIVE_TITLE}</span>
            <span className="block text-sm text-gray-600 mt-1">{copy.PATH_LIVE_BODY}</span>
          </Link>
        </div>
      ) : (
        <Link href={s.href} className="inline-flex font-semibold text-[#ba3d3d] hover:underline">{s.cta}</Link>
      )}
    </section>
  )
}
