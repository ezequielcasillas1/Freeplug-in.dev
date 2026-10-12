'use client'

import { useActionState, useEffect, useRef } from 'react'
import { useTranslations } from 'next-intl'
import { Button } from '@/components/ui/button'
import { submitWebsiteRequest, type RequestWebsiteState } from './actions'

export type RequestWebsiteFormValues = {
  business_name: string
  contact_phone: string
  google_business_url: string
  notes: string
}

type Props = {
  focusMaintenance?: boolean
  /** Current values of the user's open request, so saving never blanks existing details. */
  defaultValues?: RequestWebsiteFormValues
  /** In-review requests: fields stay visible but read-only and the save button is hidden. */
  locked?: boolean
}

export function RequestWebsiteForm({
  focusMaintenance = false,
  defaultValues,
  locked = false,
}: Props) {
  const [state, formAction, pending] = useActionState(
    submitWebsiteRequest,
    {} as RequestWebsiteState
  )
  const notesRef = useRef<HTMLTextAreaElement>(null)
  const t = useTranslations('dashboard.request')

  useEffect(() => {
    if (locked || !focusMaintenance || !notesRef.current) return
    notesRef.current.scrollIntoView({ behavior: 'smooth', block: 'center' })
    notesRef.current.focus()
  }, [focusMaintenance, locked])

  // Update mode: an open request was loaded and is still editable (status 'submitted').
  const isUpdate = Boolean(defaultValues) && !locked
  const submitLabel = isUpdate ? t('submitLabel.saveChanges') : t('submitLabel.submitRequest')

  const lockedClass = locked ? ' bg-zinc-50 text-gray-600 cursor-default' : ''

  const notesLabel = focusMaintenance
    ? t('notesLabel.describeMaintenanceChangesNeeded')
    : t('notesLabel.tellUsAboutBusiness')

  const notesHint = focusMaintenance
    ? t('notesHint')
    : null

  return (
    <form
      action={locked ? undefined : formAction}
      onSubmit={locked ? (e) => e.preventDefault() : undefined}
      className="space-y-4 max-w-lg"
    >
      {state?.error ? (
        <p className="text-sm text-red-600" role="alert">
          {state.error}
        </p>
      ) : null}

      {focusMaintenance ? (
        <p className="rounded-lg bg-zinc-50 border border-zinc-200 text-gray-800 px-4 py-3 text-sm">
          {t('maintenancePricingFollowsQuickReview')}
        </p>
      ) : null}

      <div>
        <label htmlFor="business_name" className="block text-sm font-medium text-gray-700 mb-1">
          {t('businessName')}
        </label>
        <input
          id="business_name"
          name="business_name"
          required
          maxLength={200}
          defaultValue={defaultValues?.business_name ?? ''}
          readOnly={locked}
          className={`w-full rounded-lg border border-zinc-300 px-3 py-2 text-gray-900 focus:ring-2 focus:ring-[#ba3d3d] outline-none${lockedClass}`}
        />
      </div>

      <div>
        <label
          htmlFor="google_business_url"
          className="block text-sm font-medium text-gray-700 mb-1"
        >
          {t('googleBusinessProfileUrl')}
        </label>
        <input
          id="google_business_url"
          name="google_business_url"
          type="url"
          placeholder="https://g.page/..."
          maxLength={2000}
          defaultValue={defaultValues?.google_business_url ?? ''}
          readOnly={locked}
          className={`w-full rounded-lg border border-zinc-300 px-3 py-2 text-gray-900 focus:ring-2 focus:ring-[#ba3d3d] outline-none${lockedClass}`}
        />
      </div>

      <div>
        <label htmlFor="contact_phone" className="block text-sm font-medium text-gray-700 mb-1">
          {t('phone')}
        </label>
        <input
          id="contact_phone"
          name="contact_phone"
          type="tel"
          maxLength={50}
          defaultValue={defaultValues?.contact_phone ?? ''}
          readOnly={locked}
          className={`w-full rounded-lg border border-zinc-300 px-3 py-2 text-gray-900 focus:ring-2 focus:ring-[#ba3d3d] outline-none${lockedClass}`}
        />
      </div>

      <div id="notes">
        <label htmlFor="notes" className="block text-sm font-medium text-gray-700 mb-1">
          {notesLabel}
        </label>
        {notesHint ? <p className="text-xs text-gray-500 mb-2">{notesHint}</p> : null}
        <textarea
          ref={notesRef}
          id="notes"
          name="notes"
          rows={5}
          maxLength={5000}
          required={focusMaintenance}
          defaultValue={defaultValues?.notes ?? ''}
          readOnly={locked}
          className={`w-full rounded-lg border border-zinc-300 px-3 py-2 text-gray-900 focus:ring-2 focus:ring-[#ba3d3d] outline-none resize-y${lockedClass}`}
        />
      </div>

      {locked ? null : (
        <Button type="submit" className="w-full sm:w-auto" disabled={pending}>
          {pending ? t('sending') : submitLabel}
        </Button>
      )}
    </form>
  )
}
