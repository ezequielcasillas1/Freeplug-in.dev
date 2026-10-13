'use server'

import { createClient } from '@/lib/supabase/server'
import { domainRequestSchema } from '@/lib/outreach/schemas'
import { GENERIC_TRY_AGAIN } from '@/lib/outreach/copy'

/** "Set up my domain": one row in domain_requests (RLS: own rows, status pending). Admin handles it by hand. */
export async function requestDomainSetup(input: unknown): Promise<{ ok: true } | { ok: false; error: string }> {
  const parsed = domainRequestSchema.safeParse(input)
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0]?.message ?? GENERIC_TRY_AGAIN }
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return { ok: false, error: GENERIC_TRY_AGAIN }
  const { error } = await supabase.from('domain_requests').insert({
    user_id: user.id,
    kind: parsed.data.kind,
    domain: parsed.data.kind === 'have_domain' ? parsed.data.domain : null,
  })
  return error ? { ok: false, error: GENERIC_TRY_AGAIN } : { ok: true }
}
