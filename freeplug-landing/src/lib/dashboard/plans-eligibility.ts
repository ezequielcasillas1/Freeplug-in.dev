import type { SupabaseClient } from '@supabase/supabase-js'

/** Hosting checkout is allowed after the user has submitted a website request (or evaluation progressed). */
export async function isPlansCheckoutAllowed(
  supabase: SupabaseClient,
  userId: string
): Promise<boolean> {
  const { data: profile } = await supabase
    .from('profiles')
    .select('evaluation_status')
    .eq('id', userId)
    .maybeSingle()

  const st = profile?.evaluation_status
  if (st && st !== 'none') return true

  const { count } = await supabase
    .from('website_requests')
    .select('*', { count: 'exact', head: true })
    .eq('user_id', userId)

  return (count ?? 0) > 0
}
