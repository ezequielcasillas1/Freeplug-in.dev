'use server'

import { revalidatePath } from 'next/cache'
import { createAdminClient } from '@/lib/supabase/admin'
import { assertTemplatesAccess } from './guard'

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

/**
 * Lock a customer's template pick (Lina approved it, or a license was recorded). Admin + localhost
 * only (assertTemplatesAccess). Sets template_locked_at once; after that the customer can't change it.
 */
export async function lockTemplatePickAction(form: FormData): Promise<void> {
  await assertTemplatesAccess()
  const id = String(form.get('request_id') ?? '')
  if (!UUID_RE.test(id)) throw new Error('bad request id')
  const { error } = await createAdminClient()
    .from('website_requests')
    .update({ template_locked_at: new Date().toISOString() })
    .eq('id', id)
    .is('template_locked_at', null)
    .not('template_choice', 'is', null)
  if (error) throw new Error('lock failed')
  revalidatePath('/admin/templates/picks')
}
