import Link from 'next/link'
import * as copy from '@/lib/consultation/copy'
import { chooseFormPath } from './actions'

export function ConsultationChooser({ businessName }: { businessName: string }) {
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
          <Link
            href="/dashboard/consultation/live?new=1"
            className="min-h-[44px] inline-flex items-center justify-center rounded-md border border-[#ba3d3d] px-4 text-sm font-semibold text-[#ba3d3d] hover:bg-[#ba3d3d]/5"
          >
            {copy.PATH_LIVE_CTA}
          </Link>
        </div>
      </div>
      <p className="mt-8 text-sm text-gray-500">
        <Link href="/dashboard" className="text-[#ba3d3d] hover:underline">← Back to dashboard</Link>
      </p>
    </div>
  )
}
