import Link from 'next/link'
import { consultationCopy } from '@/lib/consultation/i18n'
import { currentLocale } from '@/i18n/current-locale'
import { chooseFormPath } from './actions'
import { CALCOM_SESSION_LENGTHS } from '@/lib/consultation/scheduler'

export async function ConsultationChooser({ businessName }: { businessName: string }) {
  const copy = consultationCopy(await currentLocale())
  return (
    <div className="max-w-3xl">
      <h1 className="text-3xl font-bold text-gray-900 mb-2">{copy.CONSULT_CARD_HEADING}</h1>
      <p className="text-gray-600 mb-2">{copy.CONSULT_CARD_BODY}</p>
      <p className="text-sm text-gray-500 mb-8">{businessName}</p>
      <div className="grid gap-6 md:grid-cols-2">
        <form action={chooseFormPath} className="rounded-xl border border-zinc-200 bg-white p-6 shadow-sm flex flex-col" data-testid="path-form">
          <p className="text-xs font-semibold uppercase tracking-wide text-[#ba3d3d] mb-1">Option A</p>
          <h2 className="text-xl font-semibold text-gray-900 mb-2">{copy.PATH_FORM_TITLE}</h2>
          <p className="text-sm text-gray-600 mb-6 flex-1">{copy.PATH_FORM_BODY}</p>
          <button type="submit" className="min-h-[44px] rounded-md bg-[#ba3d3d] px-4 text-sm font-semibold text-white hover:bg-[#9a3232]">
            {copy.PATH_FORM_CTA}
          </button>
        </form>
        <div className="rounded-xl border border-zinc-200 bg-white p-6 shadow-sm flex flex-col" data-testid="path-live">
          <p className="text-xs font-semibold uppercase tracking-wide text-[#ba3d3d] mb-1">Option B</p>
          <h2 className="text-xl font-semibold text-gray-900 mb-2">{copy.PATH_LIVE_TITLE}</h2>
          <p className="text-sm text-gray-600 mb-6 flex-1">{copy.PATH_LIVE_BODY}</p>
          <div className="flex flex-col gap-3 sm:flex-row">
            {CALCOM_SESSION_LENGTHS.map((m) => (
              <Link
                key={m}
                href={`/dashboard/consultation/live?new=1&length=${m}`}
                data-testid={`path-live-${m}`}
                className="min-h-[44px] flex-1 inline-flex items-center justify-center rounded-md border border-[#ba3d3d] px-4 text-sm font-semibold text-[#ba3d3d] hover:bg-[#ba3d3d]/5"
              >
                {m === 15 ? copy.PATH_LIVE_15_CTA : copy.PATH_LIVE_30_CTA}
              </Link>
            ))}
          </div>
        </div>
      </div>
      <p className="mt-8 text-sm text-gray-500">
        <Link href="/dashboard" className="text-[#ba3d3d] hover:underline">← Back to dashboard</Link>
      </p>
    </div>
  )
}
