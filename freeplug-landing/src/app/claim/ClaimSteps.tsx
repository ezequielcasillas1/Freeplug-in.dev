'use client'

import Link from 'next/link'
import { useCallback, useState } from 'react'
import { useRouter } from 'next/navigation'
import { Button, buttonVariants } from '@/components/ui/button'
import { cn } from '@/lib/utils/cn'
import { HostingCheckoutCard } from '@/components/plans/HostingCheckoutCard'
import { DetailsForm } from '@/components/outreach/DetailsForm'
import type { SentPhoto } from '@/components/outreach/PhotoUploadBox'
import {
  CARD_SAVED_LINE,
  GO_TO_DASHBOARD_LABEL,
  NO_CHARGE_UNTIL_LIVE,
  STEP2_BUTTON,
  STEP4_BUTTON,
  STEP4_NOTE,
  VIEW_PREVIEW_LABEL,
  WAITING_LINE,
} from '@/lib/outreach/copy'
import type { DetailKey, PrefillMap, ServiceItem } from '@/lib/outreach/schemas'
import { CHOOSE_STEP_BUTTON, CLAIM_CHANGE_PLAN_LINK } from '@/lib/plans/ladder-copy'
import { clearClaimPlanAction, confirmClaimDetailsAction, saveClaimPlanAction, startClaimSetupAction, uploadCustomerPhotoAction } from './actions'

export function ClaimDetailsStep(props: {
  prefill: PrefillMap
  services: ServiceItem[]
  initialFields?: Partial<Record<DetailKey, string>>
  initialServices?: { name: string; keep: boolean }[]
  /** Photos sent from the preview, carried over: shown as done and counted toward the 50 (Lina). */
  sentPhotos: SentPhoto[]
}) {
  const router = useRouter()
  const next = useCallback(() => router.refresh(), [router])
  return (
    <DetailsForm
      mode="claim"
      prefill={props.prefill}
      services={props.services}
      initialFields={props.initialFields}
      initialServices={props.initialServices}
      submitLabel={STEP2_BUTTON}
      successText=""
      // Claim step 2 stays disabled until every field and service has an answer (Lina).
      lockUntilComplete
      // Per upload request (PHOTO_LIMITS.maxPerCustomerRequest); the carried preview photos count
      // toward this screen's total, so the counter reads carried + new.
      photosAlreadySent={0}
      sentPhotos={props.sentPhotos}
      onSubmit={async (payload) => {
        const res = await confirmClaimDetailsAction(payload)
        return res.ok ? { ok: true, submissionId: res.submissionId } : { ok: false, error: res.error }
      }}
      uploadPhoto={async (submissionId, clientPhotoId, blob) => {
        const fd = new FormData()
        fd.set('submissionId', submissionId ?? '')
        fd.set('id', clientPhotoId)
        fd.set('file', blob, 'photo.jpg')
        const res = await uploadCustomerPhotoAction(fd)
        return res.ok ? { ok: true, photoId: res.photoId } : { ok: false, code: res.code, error: res.error }
      }}
      onDone={next}
    />
  )
}

export function ClaimPlanStep() {
  const router = useRouter()
  return (
    <HostingCheckoutCard
      embedded
      bare
      stickyOnPhone
      chooseLabelFor={CHOOSE_STEP_BUTTON}
      noteAboveButton={NO_CHARGE_UNTIL_LIVE}
      onChoosePlan={async (plan) => {
        const err = await saveClaimPlanAction(plan)
        if (!err) router.refresh()
        return err
      }}
    />
  )
}

/**
 * Claim step 4 summary "Change" (Lina §2, optional): clears the chosen step and goes back to step 3.
 * The server refuses once the card is saved or the site is live (saveChosenPlan's lock); an open
 * setup Checkout stays valid because it doesn't carry the step (publish reads plan_step).
 */
export function ClaimChangePlanLink() {
  const router = useRouter()
  const [pending, setPending] = useState(false)
  const [error, setError] = useState<string | null>(null)
  return (
    <span className="inline-flex flex-col items-end">
      <button
        type="button"
        className="text-sm font-medium text-[#ba3d3d] underline underline-offset-2 disabled:opacity-50"
        disabled={pending}
        data-testid="claim-change-plan"
        onClick={async () => {
          setPending(true)
          setError(null)
          const err = await clearClaimPlanAction()
          if (err) {
            setError(err)
            setPending(false)
          } else router.refresh()
        }}
      >
        {CLAIM_CHANGE_PLAN_LINK}
      </button>
      {error ? (
        <span className="mt-1 text-xs text-red-700" role="alert">
          {error}
        </span>
      ) : null}
    </span>
  )
}

/**
 * Claim step 4 "Add my card": setup-mode Checkout only (startSetupCheckout, mode 'setup'). It saves
 * the card and creates no subscription and no charge; billing starts when an admin clicks Publish.
 */
export function ClaimAddCardButton() {
  const [pending, setPending] = useState(false)
  const [error, setError] = useState<string | null>(null)
  return (
    <div>
      <Button
        className="w-full sm:w-auto"
        disabled={pending}
        onClick={async () => {
          setPending(true)
          setError(null)
          const res = await startClaimSetupAction()
          if (res.ok) window.location.href = res.url
          else {
            setError(res.error)
            setPending(false)
          }
        }}
      >
        {pending ? '…' : STEP4_BUTTON}
      </Button>
      <p className="mt-2 text-xs text-gray-500" data-testid="step4-note">
        {STEP4_NOTE}
      </p>
      {error ? (
        <p className="mt-2 text-sm text-red-700" role="alert">
          {error}
        </p>
      ) : null}
    </div>
  )
}

/** After the card is saved (Sable 12:38 AM): no publish button for the customer, no "live" email. */
export function ClaimWaiting() {
  const outline = cn(buttonVariants({ variant: 'secondary', size: 'md' }), 'w-full sm:w-auto')
  return (
    <div className="space-y-4" data-testid="claim-waiting">
      <h1 className="text-xl font-semibold text-gray-900">{CARD_SAVED_LINE}</h1>
      <p className="text-gray-800">{WAITING_LINE}</p>
      <div className="flex flex-col gap-3 sm:flex-row">
        <Link href="/dashboard" className={outline}>
          {GO_TO_DASHBOARD_LABEL}
        </Link>
        <Link href="/dashboard/website" className={outline}>
          {VIEW_PREVIEW_LABEL}
        </Link>
      </div>
    </div>
  )
}
