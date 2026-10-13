'use server'

import { revalidatePath } from 'next/cache'
import { changeBusinessTypeCore, savePickCore, type PickDeps, type PickInput, type PickResult, type TypeChangeResult } from '@/lib/templates/pick'
import { pickDeps } from '@/lib/templates/server'

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
    revalidatePath('/dashboard/request-website')
    revalidatePath(`/dashboard/requests/${requestId}/template`)
  }
  return r
}
