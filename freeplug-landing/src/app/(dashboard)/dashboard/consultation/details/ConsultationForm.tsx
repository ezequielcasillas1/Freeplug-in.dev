'use client'

import { useActionState } from 'react'
import { useLocale } from 'next-intl'
import { ChecklistFields } from '@/components/consultation/ChecklistFields'
import type { Checklist } from '@/lib/consultation/checklist'
import { useConsultationCopy } from '@/lib/consultation/use-consultation-copy'
import { saveConsultationForm, type ConsultActionState } from '../actions'

export function ConsultationForm({ initial }: { initial: Checklist }) {
  const copy = useConsultationCopy()
  const lang = useLocale() === 'es' ? 'es' : 'en'
  const [state, action, pending] = useActionState(saveConsultationForm, {} as ConsultActionState)
  return (
    <form action={action} className="space-y-8" data-testid="consultation-form">
      <ChecklistFields initial={initial} lang={lang} />
      {state.error ? <p className="text-sm text-red-600" role="alert">{state.error}</p> : null}
      {state.saved ? <p className="text-sm text-green-700" role="status">{copy.SAVED_DRAFT_MESSAGE}</p> : null}
      <div className="flex flex-col gap-3 sm:flex-row">
        <button
          type="submit"
          name="intent"
          value="review"
          disabled={pending}
          className="min-h-[44px] rounded-md bg-[#ba3d3d] px-5 text-sm font-semibold text-white hover:bg-[#9a3232] disabled:opacity-50"
        >
          {copy.REVIEW_LABEL}
        </button>
        <button
          type="submit"
          name="intent"
          value="save"
          disabled={pending}
          className="min-h-[44px] rounded-md border border-zinc-300 px-5 text-sm font-semibold text-gray-800 hover:bg-zinc-50 disabled:opacity-50"
        >
          {copy.SAVE_DRAFT_LABEL}
        </button>
      </div>
    </form>
  )
}
