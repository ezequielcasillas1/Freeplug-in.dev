'use server'

import { createClient } from '@/lib/supabase/server'
import {
  clearChosenPlan,
  confirmCustomerDetails,
  saveChosenPlan,
  startSetupCheckout,
  uploadCustomerPhoto,
} from '@/lib/outreach/server'
import { customerMessage } from '@/lib/outreach/errors'
import { GENERIC_TRY_AGAIN } from '@/lib/outreach/copy'
import { resolvePlanStep } from '@/lib/plans/ladder'
import { ladderCopy } from '@/lib/plans/ladder-copy'
import { currentLocale } from '@/i18n/current-locale'

type ActionResult<T = object> = ({ ok: true } & T) | { ok: false; code?: string; error: string }

async function signedInUser() {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  return user
}

export async function confirmClaimDetailsAction(input: unknown): Promise<ActionResult<{ submissionId: string }>> {
  const user = await signedInUser()
  if (!user) return { ok: false, code: 'auth', error: GENERIC_TRY_AGAIN }
  const res = await confirmCustomerDetails(user.id, input)
  return res.ok ? res : { ok: false, code: res.code, error: customerMessage(res.code) }
}

/** One photo per request (FormData: submissionId, id = client UUID, file). */
export async function uploadCustomerPhotoAction(formData: FormData): Promise<ActionResult<{ photoId: string }>> {
  const user = await signedInUser()
  if (!user) return { ok: false, code: 'expired', error: customerMessage('expired') }
  const sid = formData.get('submissionId')
  const res = await uploadCustomerPhoto(user.id, typeof sid === 'string' && sid ? sid : null, formData.get('id'), formData.get('file'))
  return res.ok ? res : { ok: false, code: res.code, error: customerMessage(res.code) }
}

export async function saveClaimPlanAction(plan: unknown): Promise<string | null> {
  const { STEP_NOT_SELLABLE_MESSAGE, TIP_OUT_OF_RANGE } = ladderCopy(await currentLocale())
  const user = await signedInUser()
  if (!user) return GENERIC_TRY_AGAIN
  const res = await saveChosenPlan(user.id, plan)
  if (!res.ok && res.code === 'not_sellable') {
    const step = resolvePlanStep((plan as { planStep?: unknown } | null)?.planStep)
    return STEP_NOT_SELLABLE_MESSAGE(step?.name ?? 'This plan')
  }
  if (!res.ok && res.code === 'tip_out_of_range') return TIP_OUT_OF_RANGE
  return res.ok ? null : GENERIC_TRY_AGAIN
}

/** Claim step 4 "Change": back to step 3 (refused once the card is saved or the site is live). */
export async function clearClaimPlanAction(): Promise<string | null> {
  const user = await signedInUser()
  if (!user) return GENERIC_TRY_AGAIN
  const res = await clearChosenPlan(user.id)
  return res.ok ? null : GENERIC_TRY_AGAIN
}

export async function startClaimSetupAction(): Promise<ActionResult<{ url: string }>> {
  const user = await signedInUser()
  if (!user) return { ok: false, code: 'auth', error: GENERIC_TRY_AGAIN }
  try {
    const res = await startSetupCheckout({ id: user.id, email: user.email })
    return res.ok ? res : { ok: false, code: res.code, error: GENERIC_TRY_AGAIN }
  } catch (e) {
    console.error('[claim] setup checkout', e instanceof Error ? e.message : e)
    return { ok: false, code: 'stripe', error: GENERIC_TRY_AGAIN }
  }
}
