'use server'

import { revalidatePath } from 'next/cache'
import { assertAdminAccess } from '@/lib/admin/guard'
import { processDue } from '@/lib/templates/notify/notify'
import { notifyDeps } from '@/lib/templates/notify/server'

/** Manual run of the notify processor (sends due rows; locally they go to the outbox). */
export async function runDueNotifications(): Promise<void> {
  await assertAdminAccess()
  await processDue(notifyDeps())
  revalidatePath('/admin/notify-outbox')
}
