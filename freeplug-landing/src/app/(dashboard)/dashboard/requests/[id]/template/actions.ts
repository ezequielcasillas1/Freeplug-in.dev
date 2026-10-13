'use server'

import { revalidatePath } from 'next/cache'
import { cookies } from 'next/headers'
import { changeBusinessTypeCore, savePickCore, type PickDeps, type PickInput, type PickResult, type TypeChangeResult } from '@/lib/templates/pick'
import { pickDeps } from '@/lib/templates/server'
import { repickCookieName } from '@/lib/templates/repick'

/** Save the customer's template pick (and business type when still empty). Generic errors only. */
export async function saveTemplatePick(requestId: string, input: PickInput): Promise<PickResult> {
  let deps: PickDeps
  try {
    deps = await pickDeps()
  } catch {
    return { ok: false, error: 'save' }
  }
  const r = await savePickCore(deps, requestId, input)
  if (r.ok) {
    // L1: a new pick ends the "type changed" banner.
    try { (await cookies()).delete({ name: repickCookieName(requestId), path: `/dashboard/requests/${requestId}` }) } catch {}
    revalidatePath('/dashboard/request-website')
    revalidatePath(`/dashboard/requests/${requestId}/template`)
  }
  return r
}

/** Change the business type while the pick is editable; may clear a catalog pick that no longer fits. */
export async function changeBusinessType(requestId: string, type: string): Promise<TypeChangeResult> {
  let deps: PickDeps
  try {
    deps = await pickDeps()
  } catch {
    return { ok: false, error: 'save' }
  }
  const r = await changeBusinessTypeCore(deps, requestId, type)
  if (r.ok) {
    // L1: the banner stays (across Back / the request card) until the customer picks again.
    if (r.cleared) {
      try {
        ;(await cookies()).set(repickCookieName(requestId), '1', {
          path: `/dashboard/requests/${requestId}`, httpOnly: true, sameSite: 'lax', secure: process.env.NODE_ENV === 'production', maxAge: 60 * 60 * 24 * 30,
        })
      } catch {}
    }
    revalidatePath('/dashboard/request-website')
    revalidatePath(`/dashboard/requests/${requestId}/template`)
  }
  return r
}
