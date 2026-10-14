'use server'

import { revalidatePath } from 'next/cache'
import { assertAdminAccess } from '@/lib/admin/guard'
import { resendFailed } from '@/lib/templates/notify/notify'
import { isRealSendEnabled, notifyDeps } from '@/lib/templates/notify/server'
import { fireDevAlarms } from '@/lib/templates/notify/alarm'

/** "Send again" for one failed notification (same idempotency key). */
export async function sendFailedAgain(formData: FormData): Promise<void> {
  await assertAdminAccess()
  const id = Number(formData.get('id'))
  if (!Number.isSafeInteger(id) || id <= 0) return
  await resendFailed(notifyDeps(), id)
  revalidatePath('/admin/notify-outbox')
}

/** Dev only: fire every pending change alarm now (the in-memory stand-in for the Durable Object). */
export async function fireAlarmsNow(): Promise<void> {
  await assertAdminAccess()
  if (isRealSendEnabled()) return
  await fireDevAlarms(true)
  revalidatePath('/admin/notify-outbox')
}
