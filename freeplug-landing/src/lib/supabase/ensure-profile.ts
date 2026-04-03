import { createClient } from '@/lib/supabase/server'

/** Backfill profile for users created before the auth trigger existed. Uses RPC (no service role). */
export async function ensureProfile(userId: string) {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user || user.id !== userId) return

  await supabase.rpc('ensure_own_profile')
}
