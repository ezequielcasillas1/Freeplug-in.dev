'use client'

import { useActionState } from 'react'
import * as copy from '@/lib/consultation/copy'
import { agreeToSummary, changeSomething, type ConsultActionState } from '../actions'

export function SummaryActions() {
  const [state, agree, pending] = useActionState(agreeToSummary, {} as ConsultActionState)
  return (
    <div className="mt-6 space-y-3">
      {state.error ? <p className="text-sm text-red-600" role="alert">{state.error}</p> : null}
      <div className="flex flex-col gap-3 sm:flex-row">
        <form action={agree}>
          <button
            type="submit"
            disabled={pending}
            data-testid="looks-good"
            className="min-h-[44px] w-full rounded-md bg-[#ba3d3d] px-6 text-sm font-semibold text-white hover:bg-[#9a3232] disabled:opacity-50"
          >
            {copy.LOOKS_GOOD_LABEL}
          </button>
        </form>
        <form action={changeSomething}>
          <button
            type="submit"
            disabled={pending}
            data-testid="change-something"
            className="min-h-[44px] w-full rounded-md border border-zinc-300 px-6 text-sm font-semibold text-gray-800 hover:bg-zinc-50 disabled:opacity-50"
          >
            {copy.CHANGE_SOMETHING_LABEL}
          </button>
        </form>
      </div>
    </div>
  )
}
