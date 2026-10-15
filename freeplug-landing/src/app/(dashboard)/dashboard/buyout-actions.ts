'use server'

import { revalidatePath } from 'next/cache'
import { createAdminClient } from '@/lib/supabase/admin'
import { createClient } from '@/lib/supabase/server'
import { recordBuyoutRequest, type BuyoutRequestResult } from '@/lib/buyout/buyout'
import { supabaseBuyoutStore } from '@/lib/buyout/supabase-store'

/**
 * "Request a buyout quote" (dashboard and cancel page). Adds the buyout request to the customer's
 * website request, the same list maintenance requests use. At most one open buyout request per
 * customer: repeated calls (double click, two tabs) return alreadyRequested. No email is sent.
 */
export async function requestBuyoutQuote(): Promise<BuyoutRequestResult> {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return { ok: false, error: 'You must be signed in.' }

  let admin
  try {
    admin = createAdminClient()
  } catch {
    return { ok: false, error: 'Something went wrong on our side. Try again later.' }
  }

  let result: BuyoutRequestResult
  try {
    result = await recordBuyoutRequest(supabaseBuyoutStore(admin), user.id)
  } catch (e) {
    console.error('[buyout] request failed', e instanceof Error ? e.message : e)
    return { ok: false, error: 'Something went wrong on our side. Try again later.' }
  }
  if (result.ok) {
    revalidatePath('/dashboard')
    revalidatePath('/dashboard/cancel')
    revalidatePath('/admin', 'layout')
  }
  return result
}
