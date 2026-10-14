'use server'

import { revalidatePath } from 'next/cache'
import { createAdminClient } from '@/lib/supabase/admin'
import { assertTemplatesAccess } from './guard'

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

/**
 * Lock a customer's template pick (Lina approved it, or a license was recorded). Admin + localhost
 * only (assertTemplatesAccess). Sets template_locked_at once (via public.template_pick_admin_lock, which also
 * writes the template_pick_audit row); after that the customer can't change it.
 */
export async function lockTemplatePickAction(form: FormData): Promise<void> {
  const actor = await assertTemplatesAccess()
  const id = String(form.get('request_id') ?? '')
  if (!UUID_RE.test(id)) throw new Error('bad request id')
  // Aria ruling 3: lock + audit row (actor, 'lock', request id, time) in one transaction.
  const { error } = await createAdminClient().rpc('template_pick_admin_lock', { p_request_id: id, p_actor_email: actor })
  if (error) throw new Error('lock failed')
  revalidatePath('/admin/templates/picks')
}

/**
 * "Unlock for 1 hour" (Aria/Cheke, Oct 13): reopens the customer's pick window. The server window is
 * PICK_WINDOW_SERVER_MIN (65) minutes from the db clock, set atomically with an audit row by
 * public.template_pick_admin_unlock (no-op on a locked or closed request: locked always wins).
 */
export async function unlockTemplatePickAction(form: FormData): Promise<void> {
  const actor = await assertTemplatesAccess()
  const id = String(form.get('request_id') ?? '')
  if (!UUID_RE.test(id)) throw new Error('bad request id')
  const { error } = await createAdminClient().rpc('template_pick_admin_unlock', { p_request_id: id, p_actor_email: actor })
  if (error) throw new Error('unlock failed')
  revalidatePath('/admin/templates/picks')
}
