'use server'

import { revalidatePath } from 'next/cache'
import { createClient } from '@/lib/supabase/server'

export async function acknowledgeWebsiteTransfer(): Promise<
  { ok: true } | { ok: false; error: string }
> {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) {
    return { ok: false, error: 'Sign in required.' }
  }
  const { error } = await supabase.rpc('acknowledge_website_transfer')
  if (error) {
    return { ok: false, error: error.message }
  }
  revalidatePath('/dashboard')
  return { ok: true }
}
